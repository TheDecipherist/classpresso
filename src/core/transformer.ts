/**
 * Transformer - Replaces class patterns in build output
 */

import type { ClassMapping, TransformResult, ClasspressoConfig, DynamicBasePattern } from '../types/index.js';
import {
  findFiles,
  readFileContent,
  writeFileContent,
  backupFile,
  isJSFile,
  isHTMLFile,
  isRSCFile,
  DEFAULT_PATTERNS,
} from '../utils/files.js';
import { escapeRegex } from '../utils/regex.js';
import { normalizeClassString } from './scanner.js';

interface MatchPattern {
  regex: RegExp;
  supportsDataAttr: boolean;
}

/**
 * Check if a set of classes is a superset of any dynamic base pattern
 * This helps prevent hydration mismatches in React/Next.js
 */
function isSupersetOfDynamicBase(
  classes: string[],
  dynamicBasePatterns: Map<string, DynamicBasePattern>
): boolean {
  const classSet = new Set(classes);

  for (const [, pattern] of dynamicBasePatterns) {
    // Check if all base classes are present in the target classes
    const allBasePresent = pattern.baseClasses.every(cls => classSet.has(cls));

    // If all base classes are present and target has MORE classes, it's a superset
    if (allBasePresent && classes.length > pattern.baseClasses.length) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a set of classes exactly matches any dynamic base pattern
 */
function matchesDynamicBase(
  classes: string[],
  dynamicBasePatterns: Map<string, DynamicBasePattern>
): boolean {
  const classSet = new Set(classes);

  for (const [, pattern] of dynamicBasePatterns) {
    if (classes.length !== pattern.baseClasses.length) continue;

    const allMatch = pattern.baseClasses.every(cls => classSet.has(cls));
    if (allMatch) return true;
  }

  return false;
}

/**
 * Build a regex pattern to match a class string in various contexts
 */
function buildMatchPatterns(classString: string): MatchPattern[] {
  const escaped = escapeRegex(classString);

  return [
    // className="..." (JSX/HTML) - supports data attributes
    { regex: new RegExp(`(className\\s*=\\s*")${escaped}(")`,'g'), supportsDataAttr: true },
    { regex: new RegExp(`(className\\s*=\\s*')${escaped}(')`,'g'), supportsDataAttr: true },

    // className:"..." (React createElement) - no data attr support
    { regex: new RegExp(`(className\\s*:\\s*")${escaped}(")`,'g'), supportsDataAttr: false },
    { regex: new RegExp(`(className\\s*:\\s*')${escaped}(')`,'g'), supportsDataAttr: false },

    // Template literals: className:`...` (static content only)
    { regex: new RegExp(`(className\\s*:\\s*\`)${escaped}(\`)`,'g'), supportsDataAttr: false },

    // Template literals with dynamic suffix: className:`... ${...}`
    // Matches static prefix before ${...} expression
    { regex: new RegExp(`(className\\s*:\\s*\`)${escaped}( \\$\\{)`,'g'), supportsDataAttr: false },

    // "className","..." (minified) - no data attr support
    { regex: new RegExp(`("className"\\s*,\\s*")${escaped}(")`,'g'), supportsDataAttr: false },

    // class="..." (HTML) - supports data attributes
    { regex: new RegExp(`(\\bclass\\s*=\\s*")${escaped}(")`,'g'), supportsDataAttr: true },
    { regex: new RegExp(`(\\bclass\\s*=\\s*')${escaped}(')`,'g'), supportsDataAttr: true },

    // HTML entity encoded: class=&quot;...&quot; - supports data attributes
    { regex: new RegExp(`(class=&quot;)${escaped}(&quot;)`,'g'), supportsDataAttr: true },
    { regex: new RegExp(`(class=&#34;)${escaped}(&#34;)`,'g'), supportsDataAttr: true },
  ];
}

/**
 * Replace a single class pattern in content
 */
function replacePattern(
  content: string,
  originalClasses: string,
  consolidated: string,
  excludedClasses: string[],
  originalClassList: string[],
  addDataAttributes: boolean
): { content: string; replacements: number } {
  let replacements = 0;
  let result = content;

  // Build the replacement string (consolidated + excluded classes)
  const replacement = excludedClasses.length > 0
    ? `${consolidated} ${excludedClasses.join(' ')}`
    : consolidated;

  // Build the data attribute string
  const dataAttr = addDataAttributes
    ? ` data-cp-original="${originalClassList.join(' ')}"`
    : '';

  // Try exact match first
  const patterns = buildMatchPatterns(originalClasses);

  for (const { regex: pattern, supportsDataAttr } of patterns) {
    const beforeLength = result.length;
    const suffix = (addDataAttributes && supportsDataAttr) ? dataAttr : '';
    result = result.replace(pattern, `$1${replacement}$2${suffix}`);
    if (result.length !== beforeLength) {
      // Count replacements (approximate)
      const matches = content.match(pattern);
      if (matches) replacements += matches.length;
    }
  }

  return { content: result, replacements };
}

/**
 * Find all variations of a class pattern that should be replaced
 * This handles cases where classes appear in different orders
 */
function findClassVariations(
  content: string,
  mapping: ClassMapping,
  config: ClasspressoConfig
): string[] {
  const variations: string[] = [];
  const targetClasses = new Set(mapping.classes);

  // Create regex patterns to find className attributes (including HTML entity encoded and template literals)
  const classAttrPatterns = [
    /(?:className|class)\s*[=:]\s*["']([^"']+)["']/g,
    /class=&quot;([^&]+)&quot;/g,
    /class=&#34;([^&]+)&#34;/g,
    // Template literals - static only: className:`...`
    /(?:className|class)\s*:\s*`([^`$]+)`/g,
    // Template literals with dynamic suffix: className:`... ${...}`
    // Captures the static part before the ${
    /(?:className|class)\s*:\s*`([^`$]+) \$\{/g,
  ];

  for (const classAttrRegex of classAttrPatterns) {
    classAttrRegex.lastIndex = 0;
    let match;
    while ((match = classAttrRegex.exec(content)) !== null) {
      const classString = match[1];
      const { classes } = normalizeClassString(classString, config.exclude);

      // Check if this class string contains all the target classes
      if (classes.length >= targetClasses.size) {
        const classSet = new Set(classes);
        let allPresent = true;

        for (const targetClass of targetClasses) {
          if (!classSet.has(targetClass)) {
            allPresent = false;
            break;
          }
        }

        // If all target classes are present and it's an exact match
        if (allPresent && classes.length === targetClasses.size) {
          variations.push(classString);
        }
      }
    }
  }

  return [...new Set(variations)];
}

/**
 * Transform a single file
 */
async function transformFile(
  filePath: string,
  mappings: ClassMapping[],
  config: ClasspressoConfig,
  dryRun: boolean,
  dynamicBasePatterns: Map<string, DynamicBasePattern>
): Promise<{ modified: boolean; replacements: number; skippedForHydration: number; error?: string }> {
  try {
    let content = await readFileContent(filePath);
    let totalReplacements = 0;
    let skippedForHydration = 0;
    const originalContent = content;

    const isHTML = isHTMLFile(filePath);
    const isJS = isJSFile(filePath);

    for (const mapping of mappings) {
      // Skip patterns that would cause hydration mismatches
      if (dynamicBasePatterns.size > 0) {
        // For HTML files: skip if the pattern is a superset of a dynamic base
        // This prevents transforming "px-4 py-2 bg-blue" in HTML when JS has "px-4 py-2 ${dynamic}"
        if (isHTML && isSupersetOfDynamicBase(mapping.classes, dynamicBasePatterns)) {
          skippedForHydration++;
          continue;
        }

        // For JS files: skip if the pattern exactly matches a dynamic base
        // This prevents transforming the static base of template literals
        if (isJS && matchesDynamicBase(mapping.classes, dynamicBasePatterns)) {
          skippedForHydration++;
          continue;
        }
      }

      // Find all variations of this pattern in the file
      const variations = findClassVariations(content, mapping, config);

      for (const variation of variations) {
        const { content: newContent, replacements } = replacePattern(
          content,
          variation,
          mapping.consolidated,
          mapping.excludedClasses,
          mapping.classes,
          config.dataAttributes
        );
        content = newContent;
        totalReplacements += replacements;
      }
    }

    const modified = content !== originalContent;

    if (modified && !dryRun) {
      if (config.backup) {
        await backupFile(filePath);
      }
      await writeFileContent(filePath, content);
    }

    return { modified, replacements: totalReplacements, skippedForHydration };
  } catch (err) {
    return {
      modified: false,
      replacements: 0,
      skippedForHydration: 0,
      error: `Error transforming ${filePath}: ${err}`,
    };
  }
}

/**
 * Transform all files in the build output
 */
export async function transformBuildOutput(
  mappings: ClassMapping[],
  config: ClasspressoConfig,
  dryRun: boolean = false,
  dynamicBasePatterns: Map<string, DynamicBasePattern> = new Map()
): Promise<TransformResult> {
  const patterns = config.include.length > 0 ? config.include : DEFAULT_PATTERNS;
  const files = await findFiles(config.buildDir, patterns);

  let filesModified = 0;
  let totalBytesChanged = 0;
  let totalSkippedForHydration = 0;
  const errors: string[] = [];

  for (const filePath of files) {
    // Only transform JS, HTML, and RSC files
    if (!isJSFile(filePath) && !isHTMLFile(filePath) && !isRSCFile(filePath)) {
      continue;
    }

    const result = await transformFile(filePath, mappings, config, dryRun, dynamicBasePatterns);

    if (result.error) {
      errors.push(result.error);
    }

    if (result.modified) {
      filesModified++;
      // Estimate bytes changed based on replacements
      totalBytesChanged += result.replacements * 10; // Rough estimate
    }

    totalSkippedForHydration += result.skippedForHydration;
  }

  if (config.verbose && totalSkippedForHydration > 0) {
    console.log(`Skipped ${totalSkippedForHydration} pattern transformations to prevent hydration mismatches`);
  }

  return {
    filesModified,
    bytesChanged: totalBytesChanged,
    errors,
  };
}
