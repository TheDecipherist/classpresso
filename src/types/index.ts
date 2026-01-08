/**
 * Classpresso Type Definitions
 */

// Configuration
export interface ExcludeConfig {
  prefixes?: string[];
  suffixes?: string[];
  classes?: string[];
  patterns?: RegExp[];
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
}

// File location tracking
export interface FileLocation {
  filePath: string;
  line?: number;
  column?: number;
}

// Class occurrence tracking
export interface ClassOccurrence {
  classString: string;
  normalizedKey: string;
  count: number;
  locations: FileLocation[];
  classes: string[];
  excludedClasses: string[];
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

// Scan result
export interface ScanResult {
  occurrences: Map<string, ClassOccurrence>;
  files: FileStats[];
  errors: string[];
}

// Transform result
export interface TransformResult {
  filesModified: number;
  bytesChanged: number;
  errors: string[];
}
