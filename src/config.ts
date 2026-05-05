/**
 * Configuration loader for Classpresso
 */

import { readFileContent } from './utils/files.js';
import { stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ClasspressoConfig } from './types/index.js';

/**
 * Build directory candidates in priority order.
 * When multiple exist, we use the most recently modified.
 */
export const BUILD_DIR_CANDIDATES = [
  '.next',           // Next.js
  'dist',            // Vite, Angular, generic
  'build',           // Create React App, Remix, Docusaurus
  '.output',         // Nuxt 3, Solid Start
  '.svelte-kit',     // SvelteKit (intermediate)
  'public',          // Gatsby, Hugo
  '_site',           // Eleventy
  'out',             // Next.js static export
  '.vitepress/dist', // VitePress
  'web/dist',        // RedwoodJS
];

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
  debug: false,
  sendErrorReports: false,
  errorReportUrl: undefined,
  excludeNonFlattenableClasses: true,
  purgeUnusedCSS: false,
  purgeSafelist: [
    /^js-/,      // JavaScript hooks
    /^data-/,    // Data attributes used as classes
    /^is-/,      // State classes
    /^has-/,     // State classes
    /^active$/,
    /^disabled$/,
    /^hidden$/,
    /^visible$/,
  ],
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
    // Merge purgeSafelist arrays
    purgeSafelist: [
      ...(defaults.purgeSafelist || []),
      ...(userConfig.purgeSafelist || []),
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

  // Validate error reporting configuration
  if (config.sendErrorReports && !config.errorReportUrl) {
    errors.push('errorReportUrl is required when sendErrorReports is true');
  }

  if (config.errorReportUrl && !isValidHttpsUrl(config.errorReportUrl)) {
    errors.push('errorReportUrl must be a valid HTTPS URL');
  }

  return errors;
}

/**
 * Check if a URL is a valid HTTPS URL
 */
function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Auto-detect build directory from common framework patterns.
 * Returns the most recently modified build directory if multiple exist.
 * Returns null if no build directory is found.
 */
export async function detectBuildDir(cwd: string = process.cwd()): Promise<{
  detected: string | null;
  candidates: string[];
  suggestion: string | null;
}> {
  const foundDirs: Array<{ dir: string; mtime: Date }> = [];
  const existingCandidates: string[] = [];

  for (const candidate of BUILD_DIR_CANDIDATES) {
    const fullPath = path.resolve(cwd, candidate);

    if (existsSync(fullPath)) {
      existingCandidates.push(candidate);
      try {
        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          foundDirs.push({ dir: candidate, mtime: stats.mtime });
        }
      } catch {
        // Skip if we can't stat
      }
    }
  }

  // No build directories found
  if (foundDirs.length === 0) {
    return {
      detected: null,
      candidates: [],
      suggestion: 'No build directory found. Run your build command first, then try again.',
    };
  }

  // Single directory found - use it
  if (foundDirs.length === 1) {
    return {
      detected: foundDirs[0].dir,
      candidates: existingCandidates,
      suggestion: null,
    };
  }

  // Multiple directories found - use most recently modified
  foundDirs.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  const mostRecent = foundDirs[0];

  return {
    detected: mostRecent.dir,
    candidates: existingCandidates,
    suggestion: `Multiple build directories found (${existingCandidates.join(', ')}). Using most recent: ${mostRecent.dir}`,
  };
}

/**
 * Framework hints from package.json dependencies
 */
interface FrameworkHint {
  name: string;
  buildDir: string;
}

/**
 * Try to detect framework from package.json and suggest build directory
 */
export async function detectFrameworkHint(cwd: string = process.cwd()): Promise<FrameworkHint | null> {
  const packageJsonPath = path.resolve(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = await readFileContent(packageJsonPath);
    const pkg = JSON.parse(content);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Check for frameworks in priority order
    if (deps['next']) return { name: 'Next.js', buildDir: '.next' };
    if (deps['nuxt']) return { name: 'Nuxt', buildDir: '.output' };
    if (deps['@sveltejs/kit']) return { name: 'SvelteKit', buildDir: 'build' };
    if (deps['astro']) return { name: 'Astro', buildDir: 'dist' };
    if (deps['@remix-run/react']) return { name: 'Remix', buildDir: 'build' };
    if (deps['solid-start']) return { name: 'Solid Start', buildDir: '.output' };
    if (deps['@builder.io/qwik']) return { name: 'Qwik', buildDir: 'dist' };
    if (deps['gatsby']) return { name: 'Gatsby', buildDir: 'public' };
    if (deps['@angular/core']) return { name: 'Angular', buildDir: 'dist' };
    if (deps['vite']) return { name: 'Vite', buildDir: 'dist' };
    if (deps['@docusaurus/core']) return { name: 'Docusaurus', buildDir: 'build' };
    if (deps['@11ty/eleventy']) return { name: 'Eleventy', buildDir: '_site' };

    return null;
  } catch {
    return null;
  }
}
