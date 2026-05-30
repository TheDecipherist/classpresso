/**
 * Rehasher Tests
 *
 * Covers issue #6: `classpresso optimize` rewrote content-hashed assets in place,
 * keeping their original filenames. With `Cache-Control: immutable` on hashed assets,
 * returning clients then served a stale cached copy after redeploy (old cp-* rules vs
 * new cp-* references) → broken styling. The rehasher renames every modified hashed
 * asset to a new content-hash filename and rewrites all references to it.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

import { detectContentHash, captureAssetHashes, rehashAssets } from '../src/core/rehasher.js';
import { scanBuildOutput } from '../src/core/scanner.js';
import { detectConsolidatablePatterns } from '../src/core/pattern-detector.js';
import { createClassMappings } from '../src/core/consolidator.js';
import { generateConsolidatedCSS, injectConsolidatedCSS } from '../src/core/css-generator.js';
import { transformBuildOutput } from '../src/core/transformer.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import type { ClasspressoConfig } from '../src/types/index.js';

describe('detectContentHash', () => {
  it('detects Vite/Rollup style name-<hash>.ext', () => {
    expect(detectContentHash('index-D4Gx2k_p.css')).toEqual({
      prefix: 'index-',
      hash: 'D4Gx2k_p',
      ext: '.css',
    });
  });

  it('detects webpack style name.<hash>.ext', () => {
    expect(detectContentHash('main.1f2e3d4c.js')).toEqual({
      prefix: 'main.',
      hash: '1f2e3d4c',
      ext: '.js',
    });
  });

  it('detects a filename that is the hash itself', () => {
    expect(detectContentHash('a1b2c3d4e5.js')).toEqual({
      prefix: '',
      hash: 'a1b2c3d4e5',
      ext: '.js',
    });
  });

  it('does not treat human-readable names as hashes', () => {
    expect(detectContentHash('react-dom.js')).toBeNull();
    expect(detectContentHash('styles.css')).toBeNull();
    expect(detectContentHash('vendor.js')).toBeNull();
    expect(detectContentHash('index.html')).toBeNull();
  });
});

describe('rehashAssets - end to end (issue #6)', () => {
  let dir: string;

  const config = (buildDir: string): ClasspressoConfig => ({
    ...DEFAULT_CONFIG,
    buildDir,
    minOccurrences: 2,
    minClasses: 2,
    minBytesSaved: 5,
  });

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'classpresso-rehash-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('renames modified content-hashed assets and rewrites every reference', async () => {
    const assets = path.join(dir, 'assets');
    await mkdir(assets, { recursive: true });

    const cssName = 'index-a1b2c3d4.css';
    const jsName = 'app-b2c3d4e5.js';

    // A repeated utility combo that meets the consolidation thresholds.
    const combo = 'flex items-center gap-4 p-4 rounded-lg';

    // CSS file defines the utilities so cp-* declarations can be generated.
    const cssContent = [
      '.flex{display:flex}',
      '.items-center{align-items:center}',
      '.gap-4{gap:1rem}',
      '.p-4{padding:1rem}',
      '.rounded-lg{border-radius:0.5rem}',
    ].join('');
    await writeFile(path.join(assets, cssName), cssContent, 'utf-8');

    // JS references the combo (and the hashed CSS, like a real bundle manifest entry).
    const jsContent =
      `var css="/assets/${cssName}";` +
      `var a={className:"${combo}"};` +
      `var b={className:"${combo}"};`;
    await writeFile(path.join(assets, jsName), jsContent, 'utf-8');

    // index.html references both hashed assets and uses the combo.
    const htmlContent =
      `<!doctype html><html><head>` +
      `<link rel="stylesheet" href="/assets/${cssName}">` +
      `<script type="module" src="/assets/${jsName}"></script>` +
      `</head><body>` +
      `<div class="${combo}">a</div>` +
      `<div class="${combo}">b</div>` +
      `<div class="${combo}">c</div>` +
      `</body></html>`;
    await writeFile(path.join(dir, 'index.html'), htmlContent, 'utf-8');

    const cfg = config(dir);

    // --- Run the real optimization pipeline ---
    // 1. Snapshot BEFORE any mutation (as the optimize command does).
    const snapshot = await captureAssetHashes(cfg);

    // 2. Scan -> detect -> map -> generate CSS -> transform -> inject.
    const scan = await scanBuildOutput(cfg);
    const candidates = detectConsolidatablePatterns(scan.occurrences, cfg);
    expect(candidates.length).toBeGreaterThan(0); // sanity: a cp-* mapping was created
    const mappings = createClassMappings(candidates);
    const css = await generateConsolidatedCSS(mappings, cfg.buildDir, cfg.cssLayer);
    await transformBuildOutput(mappings, cfg, false, scan.dynamicBasePatterns, scan.mergeablePatterns);
    await injectConsolidatedCSS(cfg.buildDir, css);

    // At this point the bug WOULD exist: files mutated, filenames unchanged.
    expect(existsSync(path.join(assets, cssName))).toBe(true);

    // 3. Re-hash.
    const result = await rehashAssets(cfg, snapshot);

    // Both hashed assets changed content, so both must be renamed.
    expect(result.renamed.length).toBe(2);
    const renamedFrom = result.renamed.map((r) => r.fromName).sort();
    expect(renamedFrom).toEqual([cssName, jsName].sort());

    // Old filenames must be gone; new ones must exist.
    expect(existsSync(path.join(assets, cssName))).toBe(false);
    expect(existsSync(path.join(assets, jsName))).toBe(false);
    for (const r of result.renamed) {
      expect(existsSync(r.toPath)).toBe(true);
      // New hash must differ from the old one (cache-bust actually happened).
      expect(r.toName).not.toBe(r.fromName);
    }

    // The cache-busting contract: every asset referenced from HTML must exist on disk,
    // and no reference to an old (stale) filename may remain anywhere.
    const html = await readFile(path.join(dir, 'index.html'), 'utf-8');
    expect(html).not.toContain(cssName);
    expect(html).not.toContain(jsName);

    const newCss = result.renamed.find((r) => r.fromName === cssName)!.toName;
    const newJs = result.renamed.find((r) => r.fromName === jsName)!.toName;
    expect(html).toContain(newCss);
    expect(html).toContain(newJs);

    // Cross-asset reference (JS -> CSS) must also be rewritten to the new CSS name.
    const newJsContent = await readFile(path.join(assets, newJs), 'utf-8');
    expect(newJsContent).toContain(newCss);
    expect(newJsContent).not.toContain(cssName);
  });

  it('leaves assets untouched when their content did not change', async () => {
    const assets = path.join(dir, 'assets');
    await mkdir(assets, { recursive: true });

    const cssName = 'index-a1b2c3d4.css';
    await writeFile(path.join(assets, cssName), '.flex{display:flex}', 'utf-8');
    await writeFile(path.join(dir, 'index.html'), `<link href="/assets/${cssName}">`, 'utf-8');

    const cfg = config(dir);
    const snapshot = await captureAssetHashes(cfg);

    // No mutation happens between snapshot and rehash.
    const result = await rehashAssets(cfg, snapshot);

    expect(result.renamed.length).toBe(0);
    expect(existsSync(path.join(assets, cssName))).toBe(true);
  });

  it('does not rename non-hashed assets even when modified', async () => {
    const assets = path.join(dir, 'assets');
    await mkdir(assets, { recursive: true });

    // Stable, human-readable name (no content hash) - must keep its name.
    await writeFile(path.join(assets, 'styles.css'), '.a{color:red}', 'utf-8');

    const cfg = config(dir);
    const snapshot = await captureAssetHashes(cfg);

    // Mutate after snapshot.
    await writeFile(path.join(assets, 'styles.css'), '.a{color:blue}', 'utf-8');

    const result = await rehashAssets(cfg, snapshot);
    expect(result.renamed.length).toBe(0);
    expect(existsSync(path.join(assets, 'styles.css'))).toBe(true);
  });
});
