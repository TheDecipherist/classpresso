/**
 * Classpresso - CSS Class Consolidation Tool
 *
 * Compress multiple utility classes into single optimized classes
 * https://classpresso.com
 */

// Types
export type {
  ClasspressoConfig,
  ExcludeConfig,
  ClassMapping,
  ClassOccurrence,
  ConsolidationCandidate,
  OptimizationMetrics,
  MappingManifest,
  ScanResult,
  TransformResult,
  FileStats,
  DynamicBasePattern,
} from './types/index.js';

// Core functions
export { scanBuildOutput, normalizeClassString, shouldExcludeClass } from './core/scanner.js';
export { detectConsolidatablePatterns, getPatternSummary } from './core/pattern-detector.js';
export { createClassMappings, saveMappingManifest, loadMappingManifest, buildReplacementMap } from './core/consolidator.js';
export { generateConsolidatedCSS, injectConsolidatedCSS, parseUtilityClass } from './core/css-generator.js';
export { transformBuildOutput } from './core/transformer.js';
export { calculateMetrics, estimateCSSOverhead, formatBytes, formatPercentage, formatTime } from './core/metrics.js';

// Configuration
export { loadConfig, validateConfig, DEFAULT_CONFIG } from './config.js';

// Utilities
export { generateHashName, resolveCollisions } from './utils/hash.js';
export { escapeRegex, isDynamicClassString, extractDynamicBaseStrings, CLASS_PATTERNS, ALL_CLASS_PATTERNS, DYNAMIC_BASE_PATTERNS } from './utils/regex.js';
export { findFiles, readFileContent, writeFileContent, getFileSize, backupFile, DEFAULT_PATTERNS } from './utils/files.js';
