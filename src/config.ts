/**
 * Configuration loader for Classpresso
 */

import { readFileContent } from './utils/files.js';
import path from 'path';
import type { ClasspressoConfig } from './types/index.js';

/**
 * Default prefixes that indicate dynamically-generated classes from icon/component libraries.
 * Patterns containing these will be skipped to prevent hydration mismatches.
 */
export const DEFAULT_DYNAMIC_PREFIXES = [
  'lucide',      // lucide-react icons
  'heroicon',    // heroicons
  'icon-',       // generic icon patterns
  'fa-',         // Font Awesome
  'fas',         // Font Awesome solid
  'far',         // Font Awesome regular
  'fab',         // Font Awesome brands
  'material-icons', // Material Design Icons
  'mdi-',        // Material Design Icons (alternative)
  'ri-',         // Remix Icons
  'bi-',         // Bootstrap Icons
  'tabler-',     // Tabler Icons
  'phosphor-',   // Phosphor Icons
];

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: ClasspressoConfig = {
  buildDir: '.next',
  minOccurrences: 2,
  minClasses: 2,
  minBytesSaved: 10,
  hashPrefix: 'cp-',
  hashLength: 5,
  exclude: {
    prefixes: ['js-', 'data-', 'hook-', 'track-'],
    suffixes: ['-handler', '-trigger'],
    classes: [],
    patterns: [/^qa-/, /^test-/, /^e2e-/],
    files: [],
  },
  include: [],
  cssLayer: false,
  dataAttributes: false,
  manifest: true,
  backup: false,
  verbose: false,
  forceAll: false,
  excludeDynamicPatterns: true,
  dynamicPrefixes: DEFAULT_DYNAMIC_PREFIXES,
  skipPatternsWithExcludedClasses: true,
  ssr: false,
};

/**
 * Load configuration from file or use defaults
 */
export async function loadConfig(buildDir?: string): Promise<ClasspressoConfig> {
  const config = { ...DEFAULT_CONFIG };

  if (buildDir) {
    config.buildDir = buildDir;
  }

  // Try to load config file from current directory
  const configPaths = [
    'classpresso.config.js',
    'classpresso.config.mjs',
    'classpresso.config.json',
  ];

  for (const configPath of configPaths) {
    try {
      const fullPath = path.resolve(process.cwd(), configPath);

      if (configPath.endsWith('.json')) {
        const content = await readFileContent(fullPath);
        const userConfig = JSON.parse(content);
        return mergeConfig(config, userConfig);
      } else {
        // Dynamic import for JS config files
        const userConfig = await import(fullPath);
        return mergeConfig(config, userConfig.default || userConfig);
      }
    } catch {
      // Config file not found, continue to next
    }
  }

  return config;
}

/**
 * Merge user config with defaults
 */
function mergeConfig(
  defaults: ClasspressoConfig,
  userConfig: Partial<ClasspressoConfig>
): ClasspressoConfig {
  return {
    ...defaults,
    ...userConfig,
    exclude: {
      ...defaults.exclude,
      ...userConfig.exclude,
      // Merge arrays instead of replacing
      prefixes: [
        ...(defaults.exclude.prefixes || []),
        ...(userConfig.exclude?.prefixes || []),
      ],
      suffixes: [
        ...(defaults.exclude.suffixes || []),
        ...(userConfig.exclude?.suffixes || []),
      ],
      classes: [
        ...(defaults.exclude.classes || []),
        ...(userConfig.exclude?.classes || []),
      ],
      patterns: [
        ...(defaults.exclude.patterns || []),
        ...(userConfig.exclude?.patterns || []),
      ],
      files: [
        ...(defaults.exclude.files || []),
        ...(userConfig.exclude?.files || []),
      ],
    },
    // Merge dynamicPrefixes arrays
    dynamicPrefixes: [
      ...(defaults.dynamicPrefixes || []),
      ...(userConfig.dynamicPrefixes || []),
    ],
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: ClasspressoConfig): string[] {
  const errors: string[] = [];

  if (config.minOccurrences < 1) {
    errors.push('minOccurrences must be at least 1');
  }

  if (config.minClasses < 1) {
    errors.push('minClasses must be at least 1');
  }

  if (config.hashLength < 3) {
    errors.push('hashLength must be at least 3');
  }

  if (config.hashLength > 32) {
    errors.push('hashLength must be at most 32');
  }

  if (!config.hashPrefix || config.hashPrefix.length === 0) {
    errors.push('hashPrefix must not be empty');
  }

  return errors;
}
