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
} from '../types/index.js';
import {
  findFiles,
  readFileContent,
  getFileSize,
  isJSFile,
  isHTMLFile,
  isRSCFile,
  DEFAULT_PATTERNS,
} from '../utils/files.js';
import { ALL_CLASS_PATTERNS, isDynamicClassString, extractDynamicBaseStrings } from '../utils/regex.js';

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
  const files = await findFiles(config.buildDir, patterns);

  if (config.verbose) {
    console.log(`Found ${files.length} files to scan`);
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
      if (isJSFile(filePath)) {
        const dynamicBases = extractDynamicBaseStrings(content);
        for (const baseString of dynamicBases) {
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

      for (const { classString, location } of classStrings) {
        const { normalized, classes, excludedClasses } = normalizeClassString(
          classString,
          config.exclude
        );

        // Skip if all classes were excluded
        if (classes.length === 0) continue;

        // Skip single classes (no benefit to consolidate)
        if (classes.length < config.minClasses) continue;

        if (occurrences.has(normalized)) {
          const existing = occurrences.get(normalized)!;
          existing.count++;
          existing.locations.push(location);
        } else {
          occurrences.set(normalized, {
            classString,
            normalizedKey: normalized,
            count: 1,
            locations: [location],
            classes,
            excludedClasses,
          });
        }
      }
    } catch (err) {
      errors.push(`Error scanning ${filePath}: ${err}`);
    }
  }

  return {
    occurrences,
    files: fileStats,
    errors,
    dynamicBasePatterns,
  };
}
