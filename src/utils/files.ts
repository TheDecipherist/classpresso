/**
 * File utilities for Classpresso
 */

import { readFile, writeFile, stat, copyFile } from 'fs/promises';
import { glob } from 'glob';
import path from 'path';
import type { FileStats } from '../types/index.js';

/**
 * Default file patterns to scan in build output
 *
 * These patterns support all major frameworks when pointing to their build directories:
 * - Next.js: --dir .next
 * - Astro: --dir dist
 * - Nuxt: --dir .output
 * - SvelteKit: --dir build (or .svelte-kit)
 * - Remix: --dir build
 * - Solid Start: --dir .output (or dist)
 * - Qwik: --dir dist
 * - Angular: --dir dist/[project-name]
 * - Gatsby: --dir public
 * - Vite/Vue/React: --dir dist
 * - Ember: --dir dist
 * - VitePress: --dir .vitepress/dist
 * - Docusaurus: --dir build
 * - Eleventy (11ty): --dir _site
 * - Hugo: --dir public
 * - Parcel: --dir dist
 * - Preact: --dir build (or dist)
 * - Gridsome: --dir dist
 * - RedwoodJS: --dir web/dist
 * - Webpack: --dir dist
 */
export const DEFAULT_PATTERNS = [
  // === Next.js (.next directory) ===
  // Client-side chunks
  'static/chunks/**/*.js',
  'static/css/**/*.css',
  // Server components (Next.js App Router)
  'server/app/**/*.js',
  'server/app/**/*.html',
  'server/app/**/*.rsc',
  // Server chunks (contains Client Component code used for hydration)
  'server/chunks/**/*.js',
  // Standalone build (Next.js output: 'standalone')
  'standalone/.next/static/chunks/**/*.js',
  'standalone/.next/static/css/**/*.css',
  'standalone/.next/server/app/**/*.js',
  'standalone/.next/server/app/**/*.html',
  'standalone/.next/server/app/**/*.rsc',
  'standalone/.next/server/chunks/**/*.js',

  // === Nuxt (.output directory) ===
  'public/**/*.html',
  'public/**/*.js',
  'public/**/*.css',
  'public/_nuxt/**/*.js',
  'public/_nuxt/**/*.css',
  'server/**/*.mjs',
  'server/chunks/**/*.mjs',

  // === SvelteKit (build directory) ===
  // Static adapter output
  '**/*.html',
  '_app/**/*.js',
  '_app/**/*.css',
  // Node adapter output
  'client/**/*.js',
  'client/**/*.css',
  'server/**/*.js',

  // === Astro (dist directory) ===
  '_astro/**/*.js',
  '_astro/**/*.css',
  // SSR/Hybrid build - Client assets
  'client/_astro/**/*.js',
  'client/_astro/**/*.css',

  // === Remix (build directory) ===
  'client/**/*.js',
  'client/**/*.css',
  'server/**/*.js',

  // === Solid Start (.output or dist directory) ===
  'public/**/*.html',
  'public/**/*.js',
  'public/**/*.css',
  '_build/**/*.js',
  '_build/**/*.css',

  // === Qwik (dist directory) ===
  'build/**/*.js',
  'build/**/*.css',
  'q-*.js',

  // === Angular (dist/[project] directory) ===
  // Angular 17+ uses browser subdirectory
  'browser/**/*.js',
  'browser/**/*.css',
  'browser/**/*.html',
  // Legacy Angular output
  '*.js',
  '*.css',
  '*.html',

  // === Gatsby (public directory) ===
  'page-data/**/*.json',
  '*.js',
  '*.css',
  '*.html',

  // === Vite/Vue/React generic (dist directory) ===
  'assets/**/*.js',
  'assets/**/*.css',
  'index.html',

  // === Ember (dist directory) ===
  'assets/**/*.js',
  'assets/**/*.css',
  '*.html',

  // === VitePress (.vitepress/dist directory) ===
  'assets/**/*.js',
  'assets/**/*.css',
  '**/*.html',

  // === Docusaurus (build directory) ===
  'assets/**/*.js',
  'assets/**/*.css',
  '**/*.html',

  // === Eleventy/11ty (_site directory) ===
  '**/*.html',
  '**/*.js',
  '**/*.css',

  // === Hugo (public directory) ===
  '**/*.html',
  '**/*.js',
  '**/*.css',

  // === Parcel (dist directory) ===
  '*.html',
  '*.js',
  '*.css',

  // === Preact (build directory) ===
  'bundle.js',
  'bundle.*.js',
  '*.css',
  '*.html',

  // === Gridsome (dist directory) ===
  'assets/**/*.js',
  'assets/**/*.css',
  '**/*.html',

  // === RedwoodJS (web/dist directory) ===
  'static/**/*.js',
  'static/**/*.css',
  '*.html',

  // === Webpack generic (dist directory) ===
  '*.js',
  '*.css',
  '*.html',
  'js/**/*.js',
  'css/**/*.css',
];

/**
 * Find files matching patterns in a build directory
 */
export async function findFiles(
  buildDir: string,
  patterns: string[]
): Promise<string[]> {
  // Create full patterns and deduplicate
  const globPatterns = [...new Set(patterns.map(p => path.join(buildDir, p)))];

  // Use windowsPathsNoEscape for Windows compatibility
  const allFiles = await glob(globPatterns, {
    nodir: true,
    windowsPathsNoEscape: true
  });

  // Remove duplicates (in case patterns overlap)
  return [...new Set(allFiles)];
}

/**
 * Read file content as string
 */
export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

/**
 * Write content to file
 */
export async function writeFileContent(
  filePath: string,
  content: string
): Promise<void> {
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

/**
 * Create a backup of a file
 */
export async function backupFile(filePath: string): Promise<string> {
  const backupPath = `${filePath}.classpresso-backup`;
  await copyFile(filePath, backupPath);
  return backupPath;
}

/**
 * Get file stats for a list of files
 */
export async function getFileStats(filePaths: string[]): Promise<FileStats[]> {
  const stats: FileStats[] = [];

  for (const filePath of filePaths) {
    try {
      const size = await getFileSize(filePath);
      stats.push({
        path: filePath,
        originalSize: size,
        modified: false,
      });
    } catch {
      // Skip files that can't be read
    }
  }

  return stats;
}

/**
 * Check if a file is a JavaScript file
 */
export function isJSFile(filePath: string): boolean {
  return /\.(js|mjs|cjs)$/.test(filePath);
}

/**
 * Check if a file is a CSS file
 */
export function isCSSFile(filePath: string): boolean {
  return /\.css$/.test(filePath);
}

/**
 * Check if a file is an HTML file
 */
export function isHTMLFile(filePath: string): boolean {
  return /\.(html|htm)$/.test(filePath);
}

/**
 * Check if a file is an RSC payload
 */
export function isRSCFile(filePath: string): boolean {
  return /\.rsc$/.test(filePath);
}

/**
 * Check if a file matches any exclusion pattern
 * Patterns can be glob-style (e.g., "**\/Demo*", "**\/ClassTester*")
 */
export function shouldExcludeFile(filePath: string, excludePatterns: string[]): boolean {
  if (!excludePatterns || excludePatterns.length === 0) {
    return false;
  }

  // Normalize path for consistent matching
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of excludePatterns) {
    // Convert glob pattern to regex
    // Support: ** (any path), * (any chars), ? (single char)
    const regexPattern = pattern
      .replace(/\\/g, '/')
      .replace(/\*\*/g, '{{DOUBLESTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')
      .replace(/{{DOUBLESTAR}}/g, '.*');

    const regex = new RegExp(regexPattern);
    if (regex.test(normalizedPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter files to exclude those matching exclusion patterns
 */
export function filterExcludedFiles(files: string[], excludePatterns: string[]): string[] {
  if (!excludePatterns || excludePatterns.length === 0) {
    return files;
  }

  return files.filter(filePath => !shouldExcludeFile(filePath, excludePatterns));
}
