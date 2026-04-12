[![classpresso.com](https://img.shields.io/badge/🌐_classpresso.com-5b21b6?style=for-the-badge)](https://classpresso.com)

# Classpresso

> **Make utility-first CSS render faster** — 50% faster style recalculation, 42% faster First Paint

Classpresso consolidates repeated utility class patterns at build time, dramatically reducing browser rendering work. Works with Tailwind, Bootstrap, Bulma, Tachyons, UnoCSS, and any utility-first CSS framework.

> **📦 Post-Build Tool — Your Development Workflow is Unchanged**
>
> Classpresso runs **after** your build (`npm run build`), not during development. Your source code is never modified — only the compiled output in `.next`, `dist`, `build`, etc. You'll always see your normal Tailwind/utility classes while developing and debugging.

## Performance Results

| Metric | Improvement |
|--------|-------------|
| Style Recalculation | **50% faster** |
| First Paint | **42% faster** |
| Memory Usage | **21% less** |
| Runtime Overhead | **0ms** |

*Benchmarks run on 1000 complex components with Playwright + Chrome DevTools Protocol*

## The Problem

Utility-first CSS means elements with 10-20+ classes:

```html
<button class="inline-flex items-center justify-center rounded-md text-sm font-medium
               transition-colors focus-visible:outline-none focus-visible:ring-2
               bg-primary text-white hover:bg-primary/90 h-10 px-4 py-2">
  Submit
</button>
```

**Every class on every element is work for the browser:**
- Parse the class string
- Look up each class in stylesheets
- Calculate specificity and resolve conflicts
- Compute final styles

With 15 classes × 500 elements = **7,500 class lookups per page load**.

## The Solution

Classpresso finds repeated patterns and consolidates them:

**Before:**
```html
<button class="inline-flex items-center justify-center rounded-md text-sm font-medium...">Submit</button>
<button class="inline-flex items-center justify-center rounded-md text-sm font-medium...">Cancel</button>
<button class="inline-flex items-center justify-center rounded-md text-sm font-medium...">Delete</button>
```

**After:**
```html
<button class="cp-btn bg-primary">Submit</button>
<button class="cp-btn bg-secondary">Cancel</button>
<button class="cp-btn bg-destructive">Delete</button>
```

**Generated CSS:**
```css
.cp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* ... all consolidated utilities */
}
```

**Result:** Fewer classes = less browser work = faster rendering.

## Installation

```bash
npm install classpresso --save-dev
```

## Quick Start

```bash
# Build your project first
npm run build

# Analyze potential savings (auto-detects build directory)
npx classpresso analyze

# Apply optimizations
npx classpresso optimize
```

Classpresso **auto-detects** your build directory (`.next`, `dist`, `build`, `.output`, etc.), so you usually don't need to specify `--dir`.

## Framework Compatibility

### CSS Frameworks

| Framework | Classes per Element | Performance Gain |
|-----------|---------------------|------------------|
| Tailwind CSS | 10-20+ typical | Excellent |
| Bootstrap | 5-15 typical | Good |
| Bulma | 5-10 typical | Good |
| Tachyons | 15-25+ typical | Excellent |
| UnoCSS | 10-20+ typical | Excellent |
| Any utility CSS | Varies | Automatic |

### Build Frameworks

Classpresso works with **20+ frameworks** out of the box:

| Framework | Build Directory | SSR Flag | Notes |
|-----------|-----------------|----------|-------|
| **React Meta-Frameworks** |
| Next.js | `.next` (default) | `--ssr` for App Router | Pages Router usually doesn't need SSR flag |
| Remix | `build` | `--ssr` recommended | |
| Gatsby | `public` | Not needed | Static only |
| RedwoodJS | `web/dist` | `--ssr` if using SSR | |
| **Vue Meta-Frameworks** |
| Nuxt 3 | `.output` | `--ssr` recommended | |
| VitePress | `.vitepress/dist` | Not needed | Static docs |
| Gridsome | `dist` | Not needed | Static only |
| **Svelte** |
| SvelteKit | `build` | `--ssr` recommended | Or `.svelte-kit` |
| **Other Frameworks** |
| Astro | `dist` | `--ssr` for islands | Static doesn't need SSR |
| Solid Start | `.output` or `dist` | `--ssr` recommended | |
| Qwik | `dist` | `--ssr` recommended | |
| Angular | `dist/[project-name]` | Not needed | Angular 17+ uses `browser/` subdir |
| Ember | `dist` | Not needed | |
| Preact | `build` or `dist` | Depends on setup | |
| **Generic Bundlers** |
| Vite | `dist` | Depends on framework | |
| Webpack | `dist` | Not needed | |
| Parcel | `dist` | Not needed | |
| Create React App | `build` | Not needed | |
| **Static Site Generators** |
| Eleventy (11ty) | `_site` | Not needed | |
| Hugo | `public` | Not needed | |
| Docusaurus | `build` | Not needed | |

**Zero code changes required.** Classpresso runs on your build output. Your React, Vue, Svelte, Solid, Qwik, Astro, Angular, or vanilla HTML stays exactly the same.

## How It Works

```
1. You run your normal build (next build, vite build, etc.)

2. Classpresso scans the output:
   → Finds all class attributes
   → Identifies patterns that repeat
   → Calculates which are worth consolidating

3. Classpresso transforms:
   → Replaces repeated patterns with short hash classes
   → Generates CSS that maps hashes to original utilities
   → Updates HTML/JS with new class names

4. Result:
   → Same visual appearance
   → Dramatically fewer class lookups
   → Faster style recalculation on every interaction
```

## CLI Commands

All commands **auto-detect** your build directory. You can override with `--dir` if needed.

### `classpresso analyze`

Analyze build output and show potential optimizations without modifying files.

```bash
classpresso analyze                        # Auto-detects build dir
classpresso analyze --dir dist             # Explicit build dir
classpresso analyze --min-occurrences 3 --min-classes 3
classpresso analyze --json
```

**Options:**
- `-d, --dir <path>` - Build directory (auto-detected if not specified)
- `--min-occurrences <n>` - Minimum times a pattern must appear (default: `2`)
- `--min-classes <n>` - Minimum classes in a pattern (default: `2`)
- `--ssr` - Enable SSR-safe mode for hydration compatibility
- `--json` - Output as JSON
- `-v, --verbose` - Verbose output
- `--debug` - Generate detailed debug log file for troubleshooting
- `--send-error-reports` - Send error reports to configured webhook
- `--error-report-url <url>` - Webhook URL for error reports

### `classpresso optimize`

Apply optimizations to the build output.

```bash
classpresso optimize                       # Auto-detects build dir
classpresso optimize --dir .next           # Explicit build dir
classpresso optimize --dry-run
classpresso optimize --backup
classpresso optimize --purge-unused        # Also remove unused CSS
```

**Options:**
- `-d, --dir <path>` - Build directory (auto-detected if not specified)
- `--min-occurrences <n>` - Minimum times a pattern must appear (default: `2`)
- `--min-classes <n>` - Minimum classes in a pattern (default: `2`)
- `--ssr` - Enable SSR-safe mode for hydration compatibility
- `--dry-run` - Show what would be done without making changes
- `--backup` - Create backup files before modifying
- `--no-manifest` - Don't generate manifest file
- `--purge-unused` - Remove unused CSS classes after consolidation
- `-v, --verbose` - Verbose output
- `--debug` - Generate detailed debug log file for troubleshooting
- `--send-error-reports` - Send error reports to configured webhook
- `--error-report-url <url>` - Webhook URL for error reports

### `classpresso validate`

Check for hydration safety issues before optimizing. Catches potential React/Vue/Svelte hydration mismatches.

```bash
classpresso validate                       # Auto-detects build dir
classpresso validate --dir .next
classpresso validate --json
```

**Example output:**
```
☕ Classpresso - Hydration Safety Validator

📊 Hydration Safety Summary

  Patterns analyzed:    22
  Hydration-safe:       17
  Server-only:          3
  Client-only:          2
  Mergeable (props):    1

⚠️  Found 5 patterns that may cause hydration issues:

  1. "flex items-center gap-4"
     Status: SERVER-ONLY
     Location: server/page.html:47
     Fix: This pattern only appears in server-rendered HTML...

💡 Recommendations

  ⚠️  Mixed server/client patterns detected.
     Use "classpresso optimize --ssr" to only consolidate safe patterns.
```

**Options:**
- `-d, --dir <path>` - Build directory (auto-detected if not specified)
- `--json` - Output as JSON
- `-v, --verbose` - Verbose output
- `--debug` - Generate detailed debug log file for troubleshooting

### `classpresso unused`

Analyze CSS for unused classes. Find dead CSS that can be removed.

```bash
classpresso unused                         # Auto-detects build dir
classpresso unused --dir dist
classpresso unused --verbose               # Show file breakdown
classpresso unused --json
```

**Example output:**
```
☕ Classpresso - Unused CSS Analyzer

📊 Summary

  CSS files scanned:    3
  Total CSS rules:      1,247
  Classes used:         892
  Classes unused:       47

💾 Size Impact

  Unused CSS bytes:     12,340 (12.1 KB)
  Gzip estimate:        3,120 (3.0 KB)

🔝 Top 10 Unused Classes (by size)

  1. hover\:bg-gradient-to-r                           234 B
  2. focus\:ring-offset-4                              189 B
  ...

💡 Recommendations

  ⚠️  Found 12.1 KB of unused CSS.
     Run "classpresso optimize --purge-unused" to remove these classes.
```

**Options:**
- `-d, --dir <path>` - Build directory (auto-detected if not specified)
- `--limit <n>` - Number of top unused classes to show (default: `20`)
- `--json` - Output as JSON
- `-v, --verbose` - Verbose output (show file breakdown)
- `--debug` - Generate detailed debug log file for troubleshooting

### `classpresso report`

Generate a report from an existing manifest.

```bash
classpresso report                         # Auto-detects build dir
classpresso report --dir .next
classpresso report --format json
classpresso report --format html > report.html
```

**Options:**
- `-d, --dir <path>` - Build directory (auto-detected if not specified)
- `--format <type>` - Output format: `text`, `json`, `html` (default: `text`)

## Integration Examples

With auto-detection, most integrations are now simpler:

### Next.js

```json
{
  "scripts": {
    "build": "next build && classpresso optimize --ssr",
    "build:analyze": "next build && classpresso analyze"
  }
}
```

### Vite / Create React App / Generic

```json
{
  "scripts": {
    "build": "vite build && classpresso optimize"
  }
}
```

Classpresso auto-detects `dist`, `build`, or your framework's output directory.

### Astro

Classpresso fully supports Astro static, SSR, and hybrid builds.

**Static Build (default):**
```json
{
  "scripts": {
    "build": "astro build && classpresso optimize --dir dist"
  }
}
```

**SSR/Hybrid Build (with React/Vue/Svelte islands):**
```json
{
  "scripts": {
    "build": "astro build && classpresso optimize --dir dist --ssr"
  }
}
```

**Configuration file:**
```javascript
// classpresso.config.js
module.exports = {
  buildDir: 'dist',
  // Use --ssr flag if you have interactive islands with client:* directives
  ssr: false,
};
```

Classpresso automatically detects Astro's build structure:
- `dist/**/*.html` - Static HTML pages
- `dist/_astro/**/*.js` - Client-side JavaScript
- `dist/_astro/**/*.css` - Compiled CSS
- `dist/server/**/*.mjs` - Server code (SSR mode)
- `dist/client/_astro/**/*` - Client assets (SSR mode)

### Nuxt 3

```json
{
  "scripts": {
    "build": "nuxt build && classpresso optimize --dir .output --ssr"
  }
}
```

### SvelteKit

```json
{
  "scripts": {
    "build": "vite build && classpresso optimize --dir build --ssr"
  }
}
```

### Remix

```json
{
  "scripts": {
    "build": "remix build && classpresso optimize --dir build --ssr"
  }
}
```

### Solid Start

```json
{
  "scripts": {
    "build": "vinxi build && classpresso optimize --dir .output --ssr"
  }
}
```

### Qwik

```json
{
  "scripts": {
    "build": "qwik build && classpresso optimize --dir dist --ssr"
  }
}
```

### Angular

```json
{
  "scripts": {
    "build": "ng build && classpresso optimize --dir dist/my-app"
  }
}
```

For Angular 17+, the output is in `dist/[project-name]/browser`.

### Gatsby

```json
{
  "scripts": {
    "build": "gatsby build && classpresso optimize --dir public"
  }
}
```

### Eleventy (11ty)

```json
{
  "scripts": {
    "build": "eleventy && classpresso optimize --dir _site"
  }
}
```

### Hugo

```bash
hugo && classpresso optimize --dir public
```

### Docusaurus

```json
{
  "scripts": {
    "build": "docusaurus build && classpresso optimize --dir build"
  }
}
```

### VitePress

```json
{
  "scripts": {
    "build": "vitepress build && classpresso optimize --dir .vitepress/dist"
  }
}
```

## SSR-Safe Mode

For **Next.js App Router**, **Remix**, or any SSR framework with hydration, use the `--ssr` flag to prevent hydration mismatches:

```bash
classpresso optimize --ssr
```

### Check Before You Optimize

Use the `validate` command to detect potential hydration issues before optimizing:

```bash
classpresso validate
```

This shows which patterns are safe to consolidate and which might cause issues. If you see warnings, use `--ssr` mode.

### What it does

SSR-safe mode only consolidates patterns that appear in **both** server-rendered HTML and client-side JavaScript. This ensures the browser sees identical class names during hydration.

**Without `--ssr`:** A pattern in HTML might get consolidated, but the JavaScript bundle still references the original classes → hydration mismatch error.

**With `--ssr`:** Only patterns found in both places are consolidated → perfect hydration.

### When to use

**Use `--ssr` for these frameworks:**
- **Next.js App Router** - Always recommended
- **Nuxt 3** - Recommended
- **SvelteKit** - Recommended
- **Remix** - Recommended
- **Solid Start** - Recommended
- **Qwik** - Recommended
- **Astro SSR/Hybrid** - If using `client:*` directives with React/Vue/Svelte islands
- **RedwoodJS** - If using SSR features

**SSR flag NOT needed:**
- **Next.js Pages Router** - Different hydration model
- **Astro Static** - No hydration
- **Gatsby** - Static generation
- **Eleventy (11ty)** - Static only
- **Hugo** - Static only
- **VitePress** - Static docs
- **Docusaurus** - Static docs
- **Angular** - Client-side rendering
- **Ember** - Client-side rendering
- **Static sites (plain HTML)** - No hydration

### Configuration

```javascript
// classpresso.config.js
module.exports = {
  ssr: true, // Enable SSR-safe mode
};
```

## Debug Mode

When troubleshooting issues, enable debug mode to generate a detailed log file:

```bash
classpresso optimize --debug
```

This creates `classpresso-debug.log` in your build directory containing:
- **System info**: Node version, OS, platform
- **Config resolution**: Final merged config values
- **Operation trace**: Every step with timestamps and timing
- **Error details**: Full stack traces if errors occur

The log file location is displayed when the command completes. Share this file when reporting issues.

## Error Reporting

Opt-in to automatically send error reports to help improve classpresso:

```bash
classpresso optimize --send-error-reports --error-report-url https://your-webhook.com/errors
```

Or configure in `classpresso.config.js`:

```javascript
module.exports = {
  sendErrorReports: true,
  errorReportUrl: 'https://your-webhook.com/errors',
};
```

**Privacy**: Error reports only include:
- Classpresso version, Node version, OS
- Error message and stack trace
- Non-sensitive config values (thresholds, flags)

**Excluded**: Full file paths, project structure, class names

## Configuration

Create a `classpresso.config.js` file in your project root:

```javascript
module.exports = {
  // Build directory
  buildDir: '.next',

  // Consolidation thresholds
  minOccurrences: 2,    // Pattern must appear at least 2 times
  minClasses: 2,        // Pattern must have at least 2 classes
  minBytesSaved: 10,    // Must save at least 10 bytes

  // Hash configuration
  hashPrefix: 'cp-',    // Prefix for consolidated classes
  hashLength: 5,        // Hash length (5 = 1M+ unique combinations)

  // Classes to exclude from consolidation (safelist)
  exclude: {
    prefixes: ['js-', 'data-', 'hook-', 'track-'],
    suffixes: ['-handler', '-trigger'],
    classes: ['no-consolidate'],
    patterns: [/^qa-/, /^test-/, /^e2e-/],
  },

  // CSS output options
  cssLayer: false,      // Wrap in @layer (e.g., 'utilities') or false for none

  // SSR & Hydration
  ssr: false,           // Enable SSR-safe mode for hydration compatibility

  // Debug options
  dataAttributes: false, // Add data-cp-original attribute with original classes
  debug: false,          // Generate detailed debug log file

  // Error reporting (opt-in)
  sendErrorReports: false,           // Send error reports to webhook
  errorReportUrl: undefined,         // Webhook URL (HTTPS required)

  // Output options
  manifest: true,       // Generate manifest.json
  backup: false,        // Create .bak files
};
```

## Benchmark Methodology

Tests run using Playwright with Chrome DevTools Protocol:

```
Test Environment
────────────────────────────────────────────────────
Browser: Chromium (headless)
CPU: Throttled 4x (simulates mobile)
Metrics: Performance.getMetrics() API

Test Pages
────────────────────────────────────────────────────
500 components: ~26,500 class instances
1000 components: ~53,000 class instances

Each component contains:
- Card container (8 classes)
- Header (12 classes)
- Button (15 classes)
- Badge (6 classes)
- Input (12 classes)
```

Run benchmarks yourself:

```bash
npm run benchmark
```

## Example Output

```
╔═══════════════════════════════════════════════════════════╗
║                   CLASSPRESSO RESULTS                     ║
╠═══════════════════════════════════════════════════════════╣
║ Files Scanned:                                         45 ║
║ Files Modified:                                        12 ║
╠═══════════════════════════════════════════════════════════╣
║ CLASS CONSOLIDATION                                       ║
║ Patterns found:                                       234 ║
║ Patterns consolidated:                                 67 ║
║ Total occurrences replaced:                           834 ║
╠═══════════════════════════════════════════════════════════╣
║ BROWSER PERFORMANCE IMPACT                                ║
║ Class lookups eliminated:                          12,510 ║
║ Estimated style recalc improvement:                  ~50% ║
║ Estimated First Paint improvement:                   ~42% ║
╠═══════════════════════════════════════════════════════════╣
║ BONUS: SIZE REDUCTION                                     ║
║ HTML bytes saved:                                12,450 B ║
║ CSS overhead:                                     3,200 B ║
║ Net reduction:                                    9,250 B ║
╚═══════════════════════════════════════════════════════════╝
```

## API Usage

Use Classpresso programmatically:

```typescript
import {
  loadConfig,
  scanBuildOutput,
  detectConsolidatablePatterns,
  createClassMappings,
  generateConsolidatedCSS,
  transformBuildOutput,
} from 'classpresso';

async function optimize() {
  const config = await loadConfig('.next');

  // Scan for patterns
  const scanResult = await scanBuildOutput(config);

  // Detect consolidation candidates
  const candidates = detectConsolidatablePatterns(
    scanResult.occurrences,
    config
  );

  // Create mappings
  const mappings = createClassMappings(candidates);

  // Generate CSS
  const css = await generateConsolidatedCSS(mappings, config.buildDir, config.cssLayer);

  // Transform build
  await transformBuildOutput(mappings, config);
}
```

## FAQ

**Does this affect my development workflow?**

No. Classpresso is a **post-build** tool that only runs after `npm run build`. During development (`npm run dev`), you see your normal Tailwind/utility classes exactly as you wrote them — perfect for debugging and toggling classes in DevTools. Classpresso only transforms the compiled production output.

**Why does this make sites faster?**

Every CSS class is work for the browser. With utility-first CSS, a button might have 15+ classes. Classpresso consolidates repeated patterns so there's less to parse, match, and calculate.

**What about bundle size?**

That's a bonus! HTML typically drops 50-60%. But the real win is browser performance — style recalculation happens on every page load, every DOM change, every interaction. 50% faster there is huge.

**Do I need to change my code?**

No. Classpresso runs on your build output, not source code. Your components stay exactly the same.

**Is there runtime overhead?**

Zero. Classpresso is build-time only. No JavaScript added, no runtime processing.

## License

MIT

## Links

- Website: [https://classpresso.com](https://classpresso.com?utm_source=github&utm_medium=referral&utm_campaign=github-readme)
- GitHub: [https://github.com/TheDecipherist/classpresso](https://github.com/TheDecipherist/classpresso)
- npm: [https://www.npmjs.com/package/classpresso](https://www.npmjs.com/package/classpresso)
