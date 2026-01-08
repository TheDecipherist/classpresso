# Classpresso

> **Make utility-first CSS render faster** — 50% faster style recalculation, 42% faster First Paint

Classpresso consolidates repeated utility class patterns at build time, dramatically reducing browser rendering work. Works with Tailwind, Bootstrap, Bulma, Tachyons, UnoCSS, and any utility-first CSS framework.

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

# Analyze potential savings
npx classpresso analyze

# Apply optimizations
npx classpresso optimize
```

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

| Framework | Build Directory | SSR Flag |
|-----------|-----------------|----------|
| Next.js | `.next` (default) | `--ssr` for App Router |
| Astro | `dist` | `--ssr` for SSR/Hybrid with islands |
| Vite | `dist` | Depends on framework |
| Create React App | `build` | Not needed |
| Remix | `build` | `--ssr` recommended |

**Zero code changes required.** Classpresso runs on your build output. Your React, Vue, Svelte, Astro, or vanilla HTML stays exactly the same.

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

### `classpresso analyze`

Analyze build output and show potential optimizations without modifying files.

```bash
classpresso analyze --dir .next
classpresso analyze --min-occurrences 3 --min-classes 3
classpresso analyze --json
```

**Options:**
- `-d, --dir <path>` - Build directory (default: `.next`)
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
classpresso optimize --dir .next
classpresso optimize --dry-run
classpresso optimize --backup
```

**Options:**
- `-d, --dir <path>` - Build directory (default: `.next`)
- `--min-occurrences <n>` - Minimum times a pattern must appear (default: `2`)
- `--min-classes <n>` - Minimum classes in a pattern (default: `2`)
- `--ssr` - Enable SSR-safe mode for hydration compatibility
- `--dry-run` - Show what would be done without making changes
- `--backup` - Create backup files before modifying
- `--no-manifest` - Don't generate manifest file
- `-v, --verbose` - Verbose output
- `--debug` - Generate detailed debug log file for troubleshooting
- `--send-error-reports` - Send error reports to configured webhook
- `--error-report-url <url>` - Webhook URL for error reports

### `classpresso report`

Generate a report from an existing manifest.

```bash
classpresso report --dir .next
classpresso report --format json
classpresso report --format html > report.html
```

**Options:**
- `-d, --dir <path>` - Build directory (default: `.next`)
- `--format <type>` - Output format: `text`, `json`, `html` (default: `text`)

## Integration Examples

### Next.js

```json
{
  "scripts": {
    "build": "next build && classpresso optimize",
    "build:analyze": "next build && classpresso analyze"
  }
}
```

### Vite

```json
{
  "scripts": {
    "build": "vite build && classpresso optimize --dir dist"
  }
}
```

### Create React App

```json
{
  "scripts": {
    "build": "react-scripts build && classpresso optimize --dir build"
  }
}
```

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

## SSR-Safe Mode

For **Next.js App Router**, **Remix**, or any SSR framework with hydration, use the `--ssr` flag to prevent hydration mismatches:

```bash
classpresso optimize --ssr
```

### What it does

SSR-safe mode only consolidates patterns that appear in **both** server-rendered HTML and client-side JavaScript. This ensures the browser sees identical class names during hydration.

**Without `--ssr`:** A pattern in HTML might get consolidated, but the JavaScript bundle still references the original classes → hydration mismatch error.

**With `--ssr`:** Only patterns found in both places are consolidated → perfect hydration.

### When to use

- **Next.js App Router** - Always recommended
- **Next.js Pages Router** - Usually not needed (different hydration model)
- **Remix** - Recommended
- **Astro SSR/Hybrid** - Recommended if using `client:*` directives with React/Vue/Svelte islands
- **Astro Static** - Not needed (no hydration)
- **Static sites (plain HTML)** - Not needed

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
║                   CLASSPRESSO RESULTS                      ║
╠═══════════════════════════════════════════════════════════╣
║ Files Scanned:                                         45  ║
║ Files Modified:                                        12  ║
╠═══════════════════════════════════════════════════════════╣
║ CLASS CONSOLIDATION                                        ║
║ Patterns found:                                       234  ║
║ Patterns consolidated:                                 67  ║
║ Total occurrences replaced:                           834  ║
╠═══════════════════════════════════════════════════════════╣
║ BROWSER PERFORMANCE IMPACT                                 ║
║ Class lookups eliminated:                          12,510  ║
║ Estimated style recalc improvement:                  ~50%  ║
║ Estimated First Paint improvement:                   ~42%  ║
╠═══════════════════════════════════════════════════════════╣
║ BONUS: SIZE REDUCTION                                      ║
║ HTML bytes saved:                                12,450 B  ║
║ CSS overhead:                                     3,200 B  ║
║ Net reduction:                                    9,250 B  ║
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

- Website: [https://classpresso.com](https://classpresso.com)
- GitHub: [https://github.com/timclausendev-web/classpresso](https://github.com/timclausendev-web/classpresso)
- npm: [https://www.npmjs.com/package/classpresso](https://www.npmjs.com/package/classpresso)
