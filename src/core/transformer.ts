/**
 * Transformer - Replaces class patterns in build output
 */

import type { ClassMapping, TransformResult, ClasspressoConfig } from '../types/index.js';
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

    // "className","..." (minified) - no data attr support
    { regex: new RegExp(`("className"\\s*,\\s*")${escaped}(")`,'g'), supportsDataAttr: false },

    // class="..." (HTML) - supports data attributes
    { regex: new RegExp(`(\\bclass\\s*=\\s*")${escaped}(")`,'g'), supportsDataAttr: true },
    { regex: new RegExp(`(\\bclass\\s*=\\s*')${escaped}(')`,'g'), supportsDataAttr: true },
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

  // Create regex to find className attributes
  const classAttrRegex = /(?:className|class)\s*[=:]\s*["']([^"']+)["']/g;

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

  return [...new Set(variations)];
}

/**
 * Transform a single file
 */
async function transformFile(
  filePath: string,
  mappings: ClassMapping[],
  config: ClasspressoConfig,
  dryRun: boolean
): Promise<{ modified: boolean; replacements: number; error?: string }> {
  try {
    let content = await readFileContent(filePath);
    let totalReplacements = 0;
    const originalContent = content;

    for (const mapping of mappings) {
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

    return { modified, replacements: totalReplacements };
  } catch (err) {
    return {
      modified: false,
      replacements: 0,
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
  dryRun: boolean = false
): Promise<TransformResult> {
  const patterns = config.include.length > 0 ? config.include : DEFAULT_PATTERNS;
  const files = await findFiles(config.buildDir, patterns);

  let filesModified = 0;
  let totalBytesChanged = 0;
  const errors: string[] = [];

  for (const filePath of files) {
    // Only transform JS, HTML, and RSC files
    if (!isJSFile(filePath) && !isHTMLFile(filePath) && !isRSCFile(filePath)) {
      continue;
    }

    const result = await transformFile(filePath, mappings, config, dryRun);

    if (result.error) {
      errors.push(result.error);
    }

    if (result.modified) {
      filesModified++;
      // Estimate bytes changed based on replacements
      totalBytesChanged += result.replacements * 10; // Rough estimate
    }
  }

  return {
    filesModified,
    bytesChanged: totalBytesChanged,
    errors,
  };
}
