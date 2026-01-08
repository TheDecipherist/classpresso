/**
 * Configuration loader for Classpresso
 */

import { readFileContent } from './utils/files.js';
import path from 'path';
import type { ClasspressoConfig } from './types/index.js';

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
  },
  include: [],
  cssLayer: false,
  dataAttributes: false,
  manifest: true,
  backup: false,
  verbose: false,
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
    },
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
