# AI Instructions for Classpresso

This file provides clear, structured instructions for AI assistants to understand and use Classpresso correctly in benchmark tests and real projects.

## What Classpresso Does

Classpresso is a **build-time CSS class consolidation tool** that:

1. Finds repeated utility class patterns in build output (HTML, JS)
2. Replaces them with short sequential names (cp-a, cp-b, etc.)
3. Generates CSS that maps those short names to the original utility styles
4. Results in fewer CSS class lookups for the browser = faster rendering

**Example transformation:**
```html
<!-- Before: 15 classes repeated across 50 buttons -->
<button class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md font-medium">

<!-- After: 1 class -->
<button class="cp-a">
```

## How Classpresso Works (Detailed Pipeline)

### Overview Flow

```
Build Output → Scanner → Pattern Detector → Consolidator → CSS Generator → Transformer
                 ↓            ↓                  ↓               ↓              ↓
           Find all     Identify           Create         Generate       Apply to
           class       patterns worth      mappings       CSS rules      HTML/JS
           strings     consolidating       (original→hash)
```

### Step 1: Scanner (`src/core/scanner.ts`)

The scanner reads all HTML and JavaScript files in the build directory and extracts class strings using regex patterns.

**What it finds:**
- HTML class attributes: `class="flex items-center"`
- JSX className: `className="flex items-center"`
- Class composition functions: `cn("flex", "items-center")`, `clsx("flex items-center")`
- Template literals: `\`flex ${condition ? "hidden" : ""}\``
- Vue/Quasar class binding: `:class="['flex', 'items-center']"`

**File types scanned:**
- `.html` files
- `.js` and `.mjs` files (bundled React/Vue/Svelte)
- `.rsc` files (React Server Component payloads in Next.js)

**Output:** A Map of each unique class pattern → locations where it appears

```typescript
Map<normalizedKey, ClassOccurrence> = {
  "bg-blue-600 flex items-center": {
    classString: "flex items-center bg-blue-600",  // Original order
    normalizedKey: "bg-blue-600 flex items-center", // Sorted for deduplication
    classes: ["flex", "items-center", "bg-blue-600"],
    count: 12,  // Appears 12 times
    locations: [
      { file: "dist/index.html", line: 45 },
      { file: "dist/assets/app.js", line: 1, col: 5234 },
      // ...
    ]
  }
}
```

**Normalization:** Class strings are sorted alphabetically to treat "flex bg-blue-600" and "bg-blue-600 flex" as the same pattern.

### Step 2: Pattern Detector (`src/core/pattern-detector.ts`)

The pattern detector analyzes scanned occurrences and decides which patterns are worth consolidating.

**Filtering criteria:**
1. **Minimum occurrences** (default: 2) - Pattern must appear at least N times
2. **Minimum classes** (default: 2) - Pattern must have at least N classes
3. **Minimum bytes saved** (default: 10) - Must save at least N bytes total
4. **Net positive savings** - Bytes saved in HTML must exceed CSS overhead added

**Bytes saved calculation:**
```
Original: "flex items-center justify-center px-4 py-2" (43 bytes)
New:      "cp-a" (4 bytes)
Savings per occurrence: 39 bytes
× 12 occurrences = 468 bytes saved in HTML

CSS overhead: ~150 bytes (the new .cp-a { ... } rule)
Net savings: 468 - 150 = 318 bytes
```

**Sequential naming:** Patterns are sorted by frequency (highest first) and assigned sequential names:
- Index 0 → `cp-a`
- Index 1 → `cp-b`
- Index 25 → `cp-z`
- Index 26 → `cp-0`
- Index 35 → `cp-9`
- Index 36 → `cp-aa`

This ensures the most frequent patterns get the shortest names for maximum savings.

**SSR safety:** In `--ssr` mode, only patterns found in BOTH server-rendered HTML AND client JavaScript are eligible. This prevents hydration mismatches where the server sends one class name but the client expects another.

### Step 3: Consolidator (`src/core/consolidator.ts`)

Creates the final mapping structure and writes the manifest file.

**ClassMapping structure:**
```typescript
{
  original: "flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md",
  normalized: "bg-blue-600 flex items-center justify-center px-4 py-2 rounded-md text-white",
  consolidated: "cp-a",
  classes: ["flex", "items-center", "justify-center", "px-4", "py-2", "bg-blue-600", "text-white", "rounded-md"],
  excludedClasses: [],  // Classes that should remain (js-*, data-*, etc.)
  frequency: 12,
  bytesSaved: 468
}
```

**Excluded classes:** Some classes are kept separate (not consolidated):
- Prefixes: `js-`, `data-`, `hook-`, `track-` (JavaScript hooks)
- User-defined patterns via config

Example: `class="flex items-center js-click-handler"` becomes `class="cp-a js-click-handler"`

### Step 4: CSS Generator (`src/core/css-generator.ts`)

Generates CSS rules that map consolidated class names to their original utility styles.

**Process:**
1. Find CSS files in build output
2. Parse with PostCSS to build a utility class → CSS declarations map
3. For each consolidated pattern, look up each class and combine declarations

**Input:** Original Tailwind/Bootstrap CSS
```css
.flex { display: flex; }
.items-center { align-items: center; }
.bg-blue-600 { background-color: rgb(37 99 235); }
```

**Output:** Consolidated CSS
```css
.cp-a {
  display: flex;
  align-items: center;
  background-color: rgb(37 99 235);
}
```

**Pseudo-class handling:** Hover, focus, and other pseudo-classes are preserved:
```css
/* Original */
.hover\:bg-blue-700:hover { background-color: rgb(29 78 216); }

/* Consolidated - pseudo-class kept */
.cp-a:hover { background-color: rgb(29 78 216); }
```

**Responsive variants:** Media queries are preserved:
```css
@media (min-width: 768px) {
  .cp-a { display: none; }  /* From md:hidden */
}
```

### Step 5: Transformer (`src/core/transformer.ts`)

Applies the mappings to actual files by replacing class strings.

**For each file:**
1. Read file content
2. Find all class patterns that match our mappings
3. Replace original class string with consolidated name (preserving excluded classes)
4. Write modified content back

**Replacement examples:**

HTML:
```html
<!-- Before -->
<button class="flex items-center justify-center px-4 py-2 bg-blue-600 text-white">

<!-- After -->
<button class="cp-a">
```

JavaScript (minified):
```javascript
// Before
{className:"flex items-center justify-center px-4 py-2 bg-blue-600 text-white"}

// After
{className:"cp-a"}
```

With excluded classes:
```html
<!-- Before -->
<button class="flex items-center js-submit-btn" data-action="submit">

<!-- After (js-submit-btn preserved) -->
<button class="cp-b js-submit-btn" data-action="submit">
```

### CSS Injection

The generated consolidated CSS is appended to the first CSS file found in the build output:

```css
/* Original Tailwind CSS... */
.flex { display: flex; }
/* ... */

/* Classpresso Consolidated Classes */
.cp-a {
  display: flex;
  align-items: center;
  justify-content: center;
  /* ... */
}
.cp-b {
  /* ... */
}
```

## Key Constraint: Build-Time Only

**CRITICAL**: Classpresso runs on BUILD OUTPUT, not source code.

```
Source Code (.tsx, .vue, .svelte) → Build Tool (Next.js, Vite) → Build Output (.html, .js) → Classpresso
```

You must run your build BEFORE running classpresso.

## CLI Commands

### Analyze (dry run)
```bash
npx classpresso analyze --dir <build-directory>
```

### Optimize (apply changes)
```bash
npx classpresso optimize --dir <build-directory>
```

### Common Build Directories

| Framework | Build Directory |
|-----------|-----------------|
| Next.js | `.next` |
| Vite/React/Vue | `dist` |
| Angular | `dist/<project-name>/browser` |
| SvelteKit | `build` |
| Astro | `dist` |
| Remix | `build` |
| Nuxt 3 | `.output` |
| Create React App | `build` |
| Gatsby | `public` |

## Using in Benchmark Tests

### Benchmark Setup Pattern

```javascript
// 1. Build the project
await exec('npm run build');

// 2. Measure BEFORE optimization
const beforeMetrics = await measurePagePerformance(page, buildUrl);

// 3. Run classpresso optimization
await exec('npx classpresso optimize --dir <build-dir>');

// 4. Measure AFTER optimization
const afterMetrics = await measurePagePerformance(page, buildUrl);

// 5. Compare results
const improvement = {
  styleRecalc: (beforeMetrics.styleRecalc - afterMetrics.styleRecalc) / beforeMetrics.styleRecalc * 100,
  firstPaint: (beforeMetrics.firstPaint - afterMetrics.firstPaint) / beforeMetrics.firstPaint * 100,
};
```

### Performance Metrics to Measure

1. **Style Recalculation Time** - Time browser spends matching CSS selectors
2. **First Paint / First Contentful Paint** - Time to first visible content
3. **DOM Content Loaded** - Time until DOM is fully parsed
4. **Memory Usage** - Heap size during rendering

### Using Chrome DevTools Protocol

```javascript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

// Enable performance metrics via CDP
const client = await context.newCDPSession(page);
await client.send('Performance.enable');

// Navigate and wait
await page.goto(url, { waitUntil: 'networkidle' });

// Get metrics
const metrics = await client.send('Performance.getMetrics');
const layoutDuration = metrics.metrics.find(m => m.name === 'LayoutDuration')?.value || 0;
const styleRecalcDuration = metrics.metrics.find(m => m.name === 'RecalcStyleDuration')?.value || 0;
```

### Throttling for Realistic Results

```javascript
// Throttle CPU to simulate mobile devices
await client.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // 4x slowdown
```

## SSR Mode for Framework Hydration

For frameworks with server-side rendering and client-side hydration (Next.js App Router, Nuxt, SvelteKit, Remix):

```bash
npx classpresso optimize --dir .next --ssr
```

The `--ssr` flag ensures only patterns found in BOTH server HTML and client JS are consolidated, preventing hydration mismatches.

## What Classpresso Produces

After optimization, you'll find:

1. **Modified HTML/JS files** - Class patterns replaced with short names
2. **CSS injected into stylesheets** - New rules mapping cp-a → original styles
3. **classpresso-manifest.json** - Record of all transformations

### Manifest Structure

```json
{
  "version": "1.0.0",
  "tool": "classpresso",
  "mappings": [
    {
      "original": "inline-flex items-center justify-center px-4 py-2 bg-blue-600",
      "consolidated": "cp-a",
      "classes": ["inline-flex", "items-center", "justify-center", "px-4", "py-2", "bg-blue-600"],
      "frequency": 12,
      "bytesSaved": 600
    }
  ],
  "metrics": {
    "totalFilesScanned": 45,
    "totalFilesModified": 12,
    "bytesSaved": 5200,
    "consolidatedPatterns": 15
  }
}
```

## Benchmark Test Template

```javascript
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';

async function runBenchmark(projectDir, buildDir) {
  const results = {
    before: {},
    after: {},
    improvements: {}
  };

  // Build the project
  execSync('npm run build', { cwd: projectDir });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // Serve the build output (use serve, http-server, or framework's preview)
  const serverProcess = execSync(`npx serve ${buildDir} -p 3456 &`, { cwd: projectDir });

  // Measure BEFORE
  await page.goto('http://localhost:3456');
  results.before = await getPerformanceMetrics(client);

  // Run classpresso
  execSync(`npx classpresso optimize --dir ${buildDir}`, { cwd: projectDir });

  // Clear browser cache and measure AFTER
  await page.context().clearCookies();
  await client.send('Network.clearBrowserCache');
  await page.goto('http://localhost:3456');
  results.after = await getPerformanceMetrics(client);

  // Calculate improvements
  results.improvements = {
    styleRecalc: percentImprovement(results.before.styleRecalc, results.after.styleRecalc),
    layoutDuration: percentImprovement(results.before.layoutDuration, results.after.layoutDuration),
    firstPaint: percentImprovement(results.before.firstPaint, results.after.firstPaint),
  };

  await browser.close();
  return results;
}

async function getPerformanceMetrics(client) {
  const { metrics } = await client.send('Performance.getMetrics');
  return {
    styleRecalc: metrics.find(m => m.name === 'RecalcStyleDuration')?.value || 0,
    layoutDuration: metrics.find(m => m.name === 'LayoutDuration')?.value || 0,
    firstPaint: metrics.find(m => m.name === 'FirstMeaningfulPaint')?.value || 0,
  };
}

function percentImprovement(before, after) {
  return ((before - after) / before * 100).toFixed(1);
}
```

## Expected Results

Based on testing with utility-first CSS frameworks:

| Metric | Typical Improvement |
|--------|---------------------|
| Style Recalculation | 30-50% faster |
| First Paint | 20-45% faster |
| Memory Usage | 15-25% less |
| HTML Size | 40-60% smaller |

Results vary based on:
- Number of repeated patterns
- Average classes per element
- Page complexity
- Framework overhead

## Troubleshooting

### No patterns found
- Check build directory path is correct
- Ensure CSS classes use standard formats (class="", className="")
- Lower thresholds: `--min-occurrences 2 --min-classes 2`

### Hydration mismatch errors
- Use `--ssr` flag for SSR frameworks
- Ensure both server HTML and client JS are in the build directory

### CSS not applying
- Check that the generated CSS is being loaded
- Verify the CSS injection point in the stylesheet

## API Usage (Programmatic)

```javascript
import {
  loadConfig,
  scanBuildOutput,
  detectConsolidatablePatterns,
  createClassMappings,
  generateConsolidatedCSS,
  transformBuildOutput,
} from 'classpresso';

async function optimize(buildDir) {
  const config = await loadConfig(buildDir);
  const scanResult = await scanBuildOutput(config);
  const candidates = detectConsolidatablePatterns(scanResult.occurrences, config);
  const mappings = createClassMappings(candidates);
  const css = await generateConsolidatedCSS(mappings, buildDir);
  await transformBuildOutput(mappings, config);
  return { mappings, css };
}
```

## Quick Reference

```bash
# Analyze potential savings (no changes)
npx classpresso analyze --dir dist

# Apply optimizations
npx classpresso optimize --dir dist

# SSR-safe mode
npx classpresso optimize --dir .next --ssr

# Verbose output
npx classpresso optimize --dir dist --verbose

# Generate debug log
npx classpresso optimize --dir dist --debug
```
