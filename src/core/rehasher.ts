/**
 * Rehasher - Restore the cache-busting contract for content-hashed assets.
 *
 * Bundlers (Vite/Rollup `[hash]`, webpack `[contenthash]`, …) name assets after their
 * PRE-optimization content. Classpresso rewrites those files in place but keeps the
 * filename, so the hash in the filename no longer reflects the SERVED content. A returning
 * client with `Cache-Control: immutable` then keeps serving a stale cached copy after a
 * redeploy: old `cp-*` rules against new `cp-*` references → broken styling.
 *
 * The fix: after all mutations are done, re-hash every content-hashed asset whose content
 * actually changed, rename it to a new content-hash filename, and rewrite every reference
 * to it (HTML, JS, CSS `url()`, and bundler manifest JSON) so the build stays internally
 * consistent. Identical input → identical output, so the names are deterministic.
 *
 * Only JS/CSS assets with a hash-shaped filename are renamed. HTML/RSC entry documents are
 * never renamed (they are served by route, not by hash) but their references are updated.
 */

import { rename } from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import path from 'path';
import type { ClasspressoConfig } from '../types/index.js';
import {
  findFiles,
  readFileContent,
  writeFileContent,
  filterExcludedFiles,
  isJSFile,
  isCSSFile,
  DEFAULT_PATTERNS,
} from '../utils/files.js';

export interface RehashRename {
  /** Absolute path before renaming */
  fromPath: string;
  /** Absolute path after renaming */
  toPath: string;
  /** Original filename (basename) */
  fromName: string;
  /** New filename (basename) */
  toName: string;
}

export interface RehashResult {
  /** Assets that were renamed to a new content-hash filename */
  renamed: RehashRename[];
  /** Number of files whose references were rewritten */
  filesUpdated: number;
  /** Non-fatal errors */
  errors: string[];
}

/**
 * Decide whether a filename segment looks like a bundler content hash.
 *
 * Content hashes are hex or base64url and effectively always contain a digit or mix
 * letter cases. Plain human-readable name parts ("react-dom", "vendor", "polyfills")
 * are all-lowercase with no digit, so they are left alone.
 */
function looksLikeHash(segment: string): boolean {
  if (segment.length < 8) return false;
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return false;
  const hasDigit = /[0-9]/.test(segment);
  const hasUpper = /[A-Z]/.test(segment);
  const hasLower = /[a-z]/.test(segment);
  return hasDigit || (hasUpper && hasLower);
}

/**
 * Split a filename into { prefix, hash, ext } when it carries a content hash.
 * Returns null when no hash-shaped segment is present.
 *
 * Handles the common forms:
 *   index-D4Gx2k_p.css   (Vite/Rollup: name-<hash>.ext)
 *   main.1f2e3d4c.js     (webpack: name.<hash>.ext)
 *   D4Gx2k_p.css         (filename is the hash itself)
 */
export function detectContentHash(
  basename: string
): { prefix: string; hash: string; ext: string } | null {
  const extMatch = basename.match(/\.[^.]+$/);
  if (!extMatch) return null;
  const ext = extMatch[0];
  const stem = basename.slice(0, -ext.length);

  // Split on the last `-` or `.` separator (NOT `_`, which appears inside base64url hashes).
  const sepMatch = stem.match(/^(.*[-.])([A-Za-z0-9_-]+)$/);
  if (sepMatch && looksLikeHash(sepMatch[2])) {
    return { prefix: sepMatch[1], hash: sepMatch[2], ext };
  }

  // Whole stem is the hash (no human-readable prefix).
  if (looksLikeHash(stem)) {
    return { prefix: '', hash: stem, ext };
  }

  return null;
}

/**
 * Compute a content hash of the SAME length as the original, so the new filename stays tidy.
 * Deterministic: identical content always yields the same name.
 */
function computeHash(content: string, length: number): string {
  const digest = crypto.createHash('sha256').update(content).digest('hex');
  return digest.slice(0, Math.max(8, length));
}

/**
 * Asset file patterns (JS + CSS) used for hashing snapshots and rehash candidates.
 */
function assetPatterns(config: ClasspressoConfig): string[] {
  return config.include.length > 0 ? config.include : DEFAULT_PATTERNS;
}

/**
 * Snapshot the content hash of every candidate asset BEFORE any mutation.
 * Compared against the post-mutation state to find what actually changed.
 */
export async function captureAssetHashes(
  config: ClasspressoConfig
): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();
  const allFiles = await findFiles(config.buildDir, assetPatterns(config));
  const files = filterExcludedFiles(allFiles, config.exclude.files || []);

  for (const filePath of files) {
    if (!isJSFile(filePath) && !isCSSFile(filePath)) continue;
    try {
      const content = await readFileContent(filePath);
      snapshot.set(path.resolve(filePath), computeHash(content, 16));
    } catch {
      // Unreadable file - skip; it simply won't be considered for rehashing.
    }
  }

  return snapshot;
}

/**
 * All text files in the build whose references may point at hashed assets.
 */
async function findReferenceFiles(buildDir: string): Promise<string[]> {
  const patterns = [
    '**/*.html',
    '**/*.htm',
    '**/*.js',
    '**/*.mjs',
    '**/*.cjs',
    '**/*.css',
    '**/*.rsc',
    '**/*.json',
    '**/*.map',
    '**/*.webmanifest',
  ];
  const files = await findFiles(buildDir, patterns);
  return [...new Set(files)];
}

/**
 * Re-hash modified content-hashed assets and rewrite every reference to them.
 *
 * @param originalHashes Snapshot from captureAssetHashes(), taken before mutation.
 */
export async function rehashAssets(
  config: ClasspressoConfig,
  originalHashes: Map<string, string>
): Promise<RehashResult> {
  const result: RehashResult = { renamed: [], filesUpdated: 0, errors: [] };

  const allFiles = await findFiles(config.buildDir, assetPatterns(config));
  const files = filterExcludedFiles(allFiles, config.exclude.files || []);

  // Plan renames for every hashed asset whose content changed.
  const renameMap = new Map<string, string>(); // old basename -> new basename
  for (const filePath of files) {
    if (!isJSFile(filePath) && !isCSSFile(filePath)) continue;

    const absPath = path.resolve(filePath);
    const original = originalHashes.get(absPath);

    let content: string;
    try {
      content = await readFileContent(filePath);
    } catch {
      continue;
    }

    const current = computeHash(content, 16);
    // Unchanged content keeps its filename - nothing to do.
    if (original !== undefined && original === current) continue;
    // A file with no snapshot entry was created during optimization; treat as changed.

    const dir = path.dirname(filePath);
    const basename = path.basename(filePath);
    const parsed = detectContentHash(basename);
    if (!parsed) continue; // Not content-hashed - renaming would break a stable name.

    const newHash = computeHash(content, parsed.hash.length);
    if (newHash === parsed.hash) continue; // Hash already reflects content (shouldn't happen, but safe).

    const newName = `${parsed.prefix}${newHash}${parsed.ext}`;
    if (newName === basename || renameMap.has(basename)) continue;

    const toPath = path.join(dir, newName);
    try {
      await rename(filePath, toPath);
      // Keep the backup paired with the renamed asset so restores still line up.
      const backup = `${filePath}.classpresso-backup`;
      if (existsSync(backup)) {
        await rename(backup, `${toPath}.classpresso-backup`);
      }
      renameMap.set(basename, newName);
      result.renamed.push({
        fromPath: filePath,
        toPath,
        fromName: basename,
        toName: newName,
      });
    } catch (err) {
      result.errors.push(`Failed to rename ${basename} -> ${newName}: ${err}`);
    }
  }

  if (renameMap.size === 0) return result;

  // Rewrite every reference to the old filenames across all text files.
  const referenceFiles = await findReferenceFiles(config.buildDir);
  for (const filePath of referenceFiles) {
    try {
      const content = await readFileContent(filePath);
      let updated = content;
      for (const [oldName, newName] of renameMap) {
        if (updated.includes(oldName)) {
          updated = updated.split(oldName).join(newName);
        }
      }
      if (updated !== content) {
        await writeFileContent(filePath, updated);
        result.filesUpdated++;
      }
    } catch (err) {
      result.errors.push(`Failed to rewrite references in ${filePath}: ${err}`);
    }
  }

  return result;
}
