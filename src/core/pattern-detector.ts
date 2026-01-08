/**
 * Pattern Detector - Identifies patterns worth consolidating
 */

import type {
  ClasspressoConfig,
  ClassOccurrence,
  ConsolidationCandidate,
} from '../types/index.js';
import { generateHashName, resolveCollisions } from '../utils/hash.js';
import { calculatePatternCSSOverhead } from './metrics.js';
import { isHydrationSafe } from './scanner.js';

/**
 * Calculate bytes saved by consolidating a pattern
 */
export function calculateBytesSaved(
  original: string,
  hashName: string,
  frequency: number,
  excludedClasses: string[]
): number {
  // Original: "flex flex-col gap-2 js-hook" (with excluded)
  // New: "cp-a7b2c js-hook"

  // We're replacing the included classes portion only
  const originalLength = original.length;
  const excludedLength = excludedClasses.join(' ').length;
  const includedLength = originalLength - excludedLength - (excludedClasses.length > 0 ? 1 : 0);

  // New length is just the hash name
  const newLength = hashName.length;

  // Savings per occurrence
  const savingsPerOccurrence = includedLength - newLength;

  // Total savings across all occurrences
  return savingsPerOccurrence * frequency;
}

/**
 * Detect patterns that are worth consolidating
 */
export function detectConsolidatablePatterns(
  occurrences: Map<string, ClassOccurrence>,
  config: ClasspressoConfig
): ConsolidationCandidate[] {
  const candidates: ConsolidationCandidate[] = [];

  for (const [, occurrence] of occurrences) {
    // Filter by minimum occurrences
    if (occurrence.count < config.minOccurrences) continue;

    // Filter by minimum classes
    if (occurrence.classes.length < config.minClasses) continue;

    // SSR mode: only transform patterns found in BOTH server and client contexts
    // This prevents React hydration mismatches
    if (config.ssr && !isHydrationSafe(occurrence)) {
      continue;
    }

    // Skip patterns that have excluded classes if skipPatternsWithExcludedClasses is enabled
    // This prevents issues like "hidden md:flex" becoming "_cp-xxx md:flex" where
    // the consolidated class has display:none that overrides the responsive md:flex
    if (config.skipPatternsWithExcludedClasses && occurrence.excludedClasses.length > 0) {
      continue;
    }

    // Generate hash name
    const hashName = generateHashName(
      occurrence.normalizedKey,
      config.hashPrefix,
      config.hashLength
    );

    // Calculate bytes saved
    const bytesSaved = calculateBytesSaved(
      occurrence.classString,
      hashName,
      occurrence.count,
      occurrence.excludedClasses
    );

    // Filter by minimum bytes saved
    if (bytesSaved < config.minBytesSaved) continue;

    // Filter by net positive savings (bytes saved > CSS overhead)
    // Skip this check if forceAll is enabled (for React hydration consistency)
    if (!config.forceAll) {
      const cssOverhead = calculatePatternCSSOverhead(occurrence.classes);
      if (bytesSaved <= cssOverhead) continue;
    }

    candidates.push({
      classString: occurrence.classString,
      normalizedKey: occurrence.normalizedKey,
      frequency: occurrence.count,
      bytesSaved,
      classes: occurrence.classes,
      excludedClasses: occurrence.excludedClasses,
      hashName,
    });
  }

  // Resolve any hash collisions
  const resolved = resolveCollisions(candidates);

  // Sort by bytes saved (highest first)
  return resolved.sort((a, b) => b.bytesSaved - a.bytesSaved);
}

/**
 * Get summary statistics for detected patterns
 */
export function getPatternSummary(candidates: ConsolidationCandidate[]): {
  totalPatterns: number;
  totalOccurrences: number;
  totalBytesSaved: number;
  avgFrequency: number;
  avgClassesPerPattern: number;
} {
  const totalPatterns = candidates.length;
  const totalOccurrences = candidates.reduce((sum, c) => sum + c.frequency, 0);
  const totalBytesSaved = candidates.reduce((sum, c) => sum + c.bytesSaved, 0);
  const totalClasses = candidates.reduce((sum, c) => sum + c.classes.length, 0);

  return {
    totalPatterns,
    totalOccurrences,
    totalBytesSaved,
    avgFrequency: totalPatterns > 0 ? totalOccurrences / totalPatterns : 0,
    avgClassesPerPattern: totalPatterns > 0 ? totalClasses / totalPatterns : 0,
  };
}
