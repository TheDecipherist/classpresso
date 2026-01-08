/**
 * Scanner - Extracts className patterns from build output
 */

import type {
  ClasspressoConfig,
  ClassOccurrence,
  FileLocation,
  ScanResult,
  FileStats,
  DynamicBasePattern,
  SourceFileType,
} from '../types/index.js';
import {
  findFiles,
  readFileContent,
  getFileSize,
  isJSFile,
  isHTMLFile,
  isRSCFile,
  DEFAULT_PATTERNS,
  filterExcludedFiles,
} from '../utils/files.js';
import { ALL_CLASS_PATTERNS, isDynamicClassString, extractDynamicBaseStrings, extractConcatBaseStrings } from '../utils/regex.js';

/**
 * Determine the source file type
 */
function getSourceFileType(filePath: string): SourceFileType {
  if (isHTMLFile(filePath)) return 'html';
  if (isRSCFile(filePath)) return 'rsc';
  return 'js';
}

/**
 * Check if pattern A's classes are a proper subset of pattern B's classes.
 * A is a proper subset of B if all classes in A are in B, and B has more classes.
 */
export function isProperSubset(classesA: string[], classesB: string[]): boolean {
  if (classesA.length >= classesB.length) return false;

  const setB = new Set(classesB);
  return classesA.every(cls => setB.has(cls));
}

/**
 * Detect patterns that appear in JS but are subsets of HTML patterns.
 * These are likely className props that get merged with component classes.
 */
export function detectMergeablePatterns(
  occurrences: Map<string, ClassOccurrence>
): Set<string> {
  const mergeablePatterns = new Set<string>();

  // Get all JS-only patterns and HTML patterns
  const jsPatterns: ClassOccurrence[] = [];
  const htmlPatterns: ClassOccurrence[] = [];

  for (const [, occurrence] of occurrences) {
    if (occurrence.sourceTypes.has('js')) {
      jsPatterns.push(occurrence);
    }
    if (occurrence.sourceTypes.has('html') || occurrence.sourceTypes.has('rsc')) {
      htmlPatterns.push(occurrence);
    }
  }

  // For each JS pattern, check if it's a subset of any HTML pattern
  for (const jsPattern of jsPatterns) {
    for (const htmlPattern of htmlPatterns) {
      if (isProperSubset(jsPattern.classes, htmlPattern.classes)) {
        // This JS pattern's classes appear as part of a larger HTML pattern
        // It's likely a className prop that gets merged
        mergeablePatterns.add(jsPattern.normalizedKey);
        break;
      }
    }
  }

  return mergeablePatterns;
}

/**
 * Check if any class in a list contains a dynamic library prefix.
 * These are classes generated at runtime by libraries like lucide-react, heroicons, etc.
 */
export function containsDynamicPrefix(
  classes: string[],
  dynamicPrefixes: string[]
): boolean {
  for (const cls of classes) {
    for (const prefix of dynamicPrefixes) {
      // For prefixes ending with '-' (e.g., "fa-", "icon-"), just check startsWith
      if (prefix.endsWith('-')) {
        if (cls.startsWith(prefix)) {
          return true;
        }
      } else {
        // For prefixes without '-' (e.g., "lucide", "fas", "far", "fab"),
        // match exact or followed by '-' to avoid false positives
        // e.g., "fab" matches "fab" or "fab-icon", but not "fabric"
        if (cls === prefix || cls.startsWith(prefix + '-')) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Check if a class occurrence is safe for SSR hydration.
 * A pattern is hydration-safe if it appears in BOTH:
 * - Server context (html or rsc)
 * - Client context (js)
 *
 * If a pattern only appears in one context, transforming it would cause
 * React hydration mismatches.
 */
export function isHydrationSafe(occurrence: ClassOccurrence): boolean {
  const hasServerContext = occurrence.sourceTypes.has('html') || occurrence.sourceTypes.has('rsc');
  const hasClientContext = occurrence.sourceTypes.has('js');

  // Must appear in both server and client contexts to be safe
  return hasServerContext && hasClientContext;
}

/**
 * Check if a class should be excluded based on config
 */
export function shouldExcludeClass(
  className: string,
  exclude: ClasspressoConfig['exclude']
): boolean {
  // Check prefix patterns
  if (exclude.prefixes) {
    for (const prefix of exclude.prefixes) {
      if (className.startsWith(prefix)) return true;
    }
  }

  // Check suffix patterns
  if (exclude.suffixes) {
    for (const suffix of exclude.suffixes) {
      if (className.endsWith(suffix)) return true;
    }
  }

  // Check exact matches
  if (exclude.classes) {
    if (exclude.classes.includes(className)) return true;
  }

  // Check regex patterns
  if (exclude.patterns) {
    for (const pattern of exclude.patterns) {
      if (pattern.test(className)) return true;
    }
  }

  return false;
}

/**
 * Normalize a class string for consistent comparison
 * - Splits into individual classes
 * - Removes excluded classes
 * - Sorts alphabetically
 * - Joins back together
 */
export function normalizeClassString(
  classString: string,
  exclude: ClasspressoConfig['exclude']
): { normalized: string; classes: string[]; excludedClasses: string[] } {
  const allClasses = classString.split(/\s+/).filter(Boolean);
  const includedClasses: string[] = [];
  const excludedClasses: string[] = [];

  for (const cls of allClasses) {
    if (shouldExcludeClass(cls, exclude)) {
      excludedClasses.push(cls);
    } else {
      includedClasses.push(cls);
    }
  }

  // Sort for consistent comparison
  const sorted = [...includedClasses].sort();
  return {
    normalized: sorted.join(' '),
    classes: includedClasses,
    excludedClasses,
  };
}

/**
 * Extract class strings from file content
 */
export function extractClassStrings(
  content: string,
  filePath: string
): Array<{ classString: string; location: FileLocation }> {
  const results: Array<{ classString: string; location: FileLocation }> = [];
  const seen = new Set<string>();

  for (const pattern of ALL_CLASS_PATTERNS) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const classString = match[1];

      // Skip empty strings
      if (!classString || !classString.trim()) continue;

      // Skip dynamic expressions
      if (isDynamicClassString(classString)) continue;

      // Skip if already seen in this file (exact match)
      const key = `${filePath}:${classString}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Calculate approximate line number
      const beforeMatch = content.substring(0, match.index);
      const line = (beforeMatch.match(/\n/g) || []).length + 1;

      results.push({
        classString: classString.trim(),
        location: {
          filePath,
          line,
        },
      });
    }
  }

  return results;
}

/**
 * Scan build directory for className patterns
 */
export async function scanBuildOutput(
  config: ClasspressoConfig
): Promise<ScanResult> {
  const occurrences = new Map<string, ClassOccurrence>();
  const dynamicBasePatterns = new Map<string, DynamicBasePattern>();
  const fileStats: FileStats[] = [];
  const errors: string[] = [];

  // Find all files to scan
  const patterns = config.include.length > 0 ? config.include : DEFAULT_PATTERNS;
  const allFiles = await findFiles(config.buildDir, patterns);

  // Filter out excluded files
  const files = filterExcludedFiles(allFiles, config.exclude.files || []);

  if (config.verbose) {
    console.log(`Found ${allFiles.length} files, scanning ${files.length} (${allFiles.length - files.length} excluded)`);
  }

  for (const filePath of files) {
    try {
      // Skip non-relevant file types
      if (!isJSFile(filePath) && !isHTMLFile(filePath) && !isRSCFile(filePath)) {
        continue;
      }

      const content = await readFileContent(filePath);
      const size = await getFileSize(filePath);

      fileStats.push({
        path: filePath,
        originalSize: size,
        modified: false,
      });

      // Extract dynamic base patterns from JS files (for hydration safety)
      // These include template literals with ${} and .concat() calls
      if (isJSFile(filePath)) {
        // Get bases from template literals: className:`base ${dynamic}`
        const dynamicBases = extractDynamicBaseStrings(content);
        // Get bases from concat calls: className:"".concat("base", variant)
        const concatBases = extractConcatBaseStrings(content);

        // Combine all dynamic bases
        const allDynamicBases = [...dynamicBases, ...concatBases];

        for (const baseString of allDynamicBases) {
          const { normalized, classes } = normalizeClassString(baseString, config.exclude);

          // Skip if too few classes
          if (classes.length < config.minClasses) continue;

          const location: FileLocation = { filePath };

          if (dynamicBasePatterns.has(normalized)) {
            dynamicBasePatterns.get(normalized)!.locations.push(location);
          } else {
            dynamicBasePatterns.set(normalized, {
              baseClasses: classes,
              normalizedKey: normalized,
              locations: [location],
            });
          }
        }
      }

      const classStrings = extractClassStrings(content, filePath);
      const sourceType = getSourceFileType(filePath);

      for (const { classString, location } of classStrings) {
        const { normalized, classes, excludedClasses } = normalizeClassString(
          classString,
          config.exclude
        );

        // Skip if all classes were excluded
        if (classes.length === 0) continue;

        // Skip single classes (no benefit to consolidate)
        if (classes.length < config.minClasses) continue;

        // Skip patterns containing dynamic library prefixes (e.g., lucide-react, heroicons)
        // These are generated at runtime and transforming them causes hydration mismatches
        if (config.excludeDynamicPatterns && containsDynamicPrefix(classes, config.dynamicPrefixes)) {
          continue;
        }

        if (occurrences.has(normalized)) {
          const existing = occurrences.get(normalized)!;
          existing.count++;
          existing.locations.push(location);
          existing.sourceTypes.add(sourceType);
        } else {
          occurrences.set(normalized, {
            classString,
            normalizedKey: normalized,
            count: 1,
            locations: [location],
            classes,
            excludedClasses,
            sourceTypes: new Set([sourceType]),
          });
        }
      }
    } catch (err) {
      errors.push(`Error scanning ${filePath}: ${err}`);
    }
  }

  // Detect patterns that are likely className props that get merged
  const mergeablePatterns = detectMergeablePatterns(occurrences);

  if (config.verbose && mergeablePatterns.size > 0) {
    console.log(`Found ${mergeablePatterns.size} patterns that appear to be merged className props`);
  }

  return {
    occurrences,
    files: fileStats,
    errors,
    dynamicBasePatterns,
    mergeablePatterns,
  };
}
