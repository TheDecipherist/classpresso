/**
 * Classpresso Type Definitions
 */

// Configuration
export interface ExcludeConfig {
  prefixes?: string[];
  suffixes?: string[];
  classes?: string[];
  patterns?: RegExp[];
  /** Glob patterns for files to exclude from scanning/transformation */
  files?: string[];
}

export interface ClasspressoConfig {
  buildDir: string;
  minOccurrences: number;
  minClasses: number;
  minBytesSaved: number;
  hashPrefix: string;
  hashLength: number;
  exclude: ExcludeConfig;
  include: string[];
  cssLayer?: string | false;
  dataAttributes: boolean;
  manifest: boolean;
  backup: boolean;
  verbose: boolean;
  /** Force consolidation of all patterns regardless of byte savings (for React hydration consistency) */
  forceAll: boolean;
  /** Skip patterns containing classes from dynamic libraries like lucide-react, heroicons, etc. (default: true) */
  excludeDynamicPatterns: boolean;
  /** Prefixes that indicate dynamically-generated classes (e.g., 'lucide', 'fa-', 'heroicon') */
  dynamicPrefixes: string[];
  /** Skip entire patterns if they contain any excluded classes (default: true)
   * When true, patterns like "hidden md:flex" won't be consolidated at all if md:flex is excluded
   * When false, excluded classes are preserved separately: "hidden md:flex" -> "_cp-xxx md:flex" */
  skipPatternsWithExcludedClasses: boolean;
  /** Enable SSR-safe mode for frameworks like Next.js (default: false)
   * When true, only transforms patterns found in BOTH HTML/RSC AND JS contexts
   * to prevent React hydration mismatches */
  ssr: boolean;
  /** Enable debug mode - generates detailed log file at {buildDir}/classpresso-debug.log */
  debug: boolean;
  /** Enable automatic error reporting to configured webhook (default: false) */
  sendErrorReports: boolean;
  /** URL to send error reports to (required if sendErrorReports is true) */
  errorReportUrl?: string;
  /** Enable CSS purging of unused utility classes after consolidation (default: false) */
  purgeUnusedCSS: boolean;
  /** Safelist of class patterns to never purge */
  purgeSafelist?: (string | RegExp)[];
  /** Automatically exclude classes that cannot be expressed as flat CSS properties (default: true).
   * Covers: variant prefixes (md:, hover:, dark:, etc.), container queries (@sm, @[800px]),
   * and combinator utilities (space-y-*, divide-x-*).
   * When true, these classes are added to excludedClasses; with skipPatternsWithExcludedClasses
   * also true (default), patterns containing them are skipped entirely — no silent CSS loss. */
  excludeNonFlattenableClasses: boolean;
}

// File location tracking
export interface FileLocation {
  filePath: string;
  line?: number;
  column?: number;
}

// Source file type for pattern tracking
export type SourceFileType = 'js' | 'html' | 'rsc';

// Class occurrence tracking
export interface ClassOccurrence {
  classString: string;
  normalizedKey: string;
  count: number;
  locations: FileLocation[];
  classes: string[];
  excludedClasses: string[];
  /** Which file types this pattern appears in */
  sourceTypes: Set<SourceFileType>;
}

// Consolidation candidate
export interface ConsolidationCandidate {
  classString: string;
  normalizedKey: string;
  frequency: number;
  bytesSaved: number;
  classes: string[];
  excludedClasses: string[];
  hashName: string;
}

// Class mapping for transformation
export interface ClassMapping {
  original: string;
  consolidated: string;
  classes: string[];
  excludedClasses: string[];
  cssDeclarations: string;
  frequency: number;
  bytesSaved: number;
}

// Optimization metrics
export interface OptimizationMetrics {
  // File metrics
  totalFilesScanned: number;
  totalFilesModified: number;

  // Class metrics
  totalClassStringsFound: number;
  uniqueClassPatterns: number;
  consolidatedPatterns: number;
  totalOccurrencesReplaced: number;

  // Size metrics
  originalTotalBytes: number;
  optimizedTotalBytes: number;
  bytesSaved: number;
  percentageReduction: number;

  // CSS metrics
  originalCSSBytes: number;
  consolidatedCSSBytes: number;
  netCSSChange: number;

  // Estimated browser impact
  estimatedParseTimeSavedMs: number;
  estimatedRenderTimeSavedMs: number;

  // Top consolidations
  topConsolidations: Array<{
    original: string;
    consolidated: string;
    frequency: number;
    bytesSaved: number;
  }>;
}

// Manifest file structure
export interface MappingManifest {
  version: string;
  tool: string;
  buildDir: string;
  created: string;
  config: Partial<ClasspressoConfig>;
  mappings: ClassMapping[];
  metrics: OptimizationMetrics;
}

// File stats for metrics
export interface FileStats {
  path: string;
  originalSize: number;
  modifiedSize?: number;
  modified: boolean;
}

// Dynamic base pattern from template literals (for hydration safety)
export interface DynamicBasePattern {
  /** The static class string before the dynamic ${} expression */
  baseClasses: string[];
  /** Normalized (sorted) version for comparison */
  normalizedKey: string;
  /** File locations where this pattern was found */
  locations: FileLocation[];
}

// Scan result
export interface ScanResult {
  occurrences: Map<string, ClassOccurrence>;
  files: FileStats[];
  errors: string[];
  /** Dynamic base patterns from JS template literals (className:`base ${dynamic}`) */
  dynamicBasePatterns: Map<string, DynamicBasePattern>;
  /** Patterns that appear in JS as subsets of HTML patterns (likely props that get merged) */
  mergeablePatterns: Set<string>;
}

// Transform result
export interface TransformResult {
  filesModified: number;
  bytesChanged: number;
  errors: string[];
}

// CSS Purge result
export interface PurgeResult {
  /** Total CSS files processed */
  filesProcessed: number;
  /** Number of CSS rules removed */
  rulesRemoved: number;
  /** Class names that were purged */
  purgedClasses: string[];
  /** Bytes saved from purging */
  bytesSaved: number;
  /** Classes that were kept (still in use) */
  keptClasses: string[];
  /** Errors encountered during purging */
  errors: string[];
}
