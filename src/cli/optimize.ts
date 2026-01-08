/**
 * Optimize Command - Apply consolidation to build output
 */

import chalk from 'chalk';
import type { ClasspressoConfig } from '../types/index.js';
import { scanBuildOutput } from '../core/scanner.js';
import { detectConsolidatablePatterns } from '../core/pattern-detector.js';
import { createClassMappings, saveMappingManifest } from '../core/consolidator.js';
import { generateConsolidatedCSS, injectConsolidatedCSS } from '../core/css-generator.js';
import { transformBuildOutput } from '../core/transformer.js';
import { calculateMetrics, estimateCSSOverhead, formatBytes, formatPercentage, formatTime } from '../core/metrics.js';
import { loadConfig } from '../config.js';

interface OptimizeOptions {
  dir: string;
  minOccurrences: string;
  minClasses: string;
  dryRun?: boolean;
  backup?: boolean;
  manifest?: boolean;
  verbose?: boolean;
}

export async function optimizeCommand(options: OptimizeOptions): Promise<void> {
  const config = await loadConfig(options.dir);

  // Override config with CLI options
  config.minOccurrences = parseInt(options.minOccurrences, 10);
  config.minClasses = parseInt(options.minClasses, 10);
  config.backup = options.backup || false;
  config.manifest = options.manifest !== false;
  config.verbose = options.verbose || false;

  const dryRun = options.dryRun || false;

  console.log(chalk.cyan('\n☕ Classpresso - Optimizing build output...\n'));

  if (dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No files will be modified\n'));
  }

  try {
    // Step 1: Scan
    console.log(chalk.gray('Scanning build output...'));
    const scanResult = await scanBuildOutput(config);
    console.log(chalk.green(`  ✓ Scanned ${scanResult.files.length} files\n`));

    // Step 2: Detect patterns
    console.log(chalk.gray('Detecting patterns...'));
    const candidates = detectConsolidatablePatterns(scanResult.occurrences, config);
    console.log(chalk.green(`  ✓ Found ${candidates.length} patterns to consolidate\n`));

    if (candidates.length === 0) {
      console.log(chalk.yellow('No patterns found that meet the consolidation criteria.'));
      console.log(chalk.gray('Try lowering --min-occurrences or --min-classes\n'));
      return;
    }

    // Step 3: Create mappings
    console.log(chalk.gray('Creating class mappings...'));
    const mappings = createClassMappings(candidates);
    console.log(chalk.green(`  ✓ Created ${mappings.length} mappings\n`));

    // Step 4: Generate CSS
    console.log(chalk.gray('Generating consolidated CSS...'));
    const consolidatedCSS = await generateConsolidatedCSS(mappings, config.buildDir, config.cssLayer);
    const cssBytes = Buffer.byteLength(consolidatedCSS, 'utf-8');
    console.log(chalk.green(`  ✓ Generated ${formatBytes(cssBytes)} of CSS\n`));

    // Step 5: Transform build output
    console.log(chalk.gray('Transforming build output...'));
    const transformResult = await transformBuildOutput(mappings, config, dryRun, scanResult.dynamicBasePatterns);
    console.log(chalk.green(`  ✓ Modified ${transformResult.filesModified} files\n`));

    if (config.verbose && scanResult.dynamicBasePatterns.size > 0) {
      console.log(chalk.gray(`  ℹ Found ${scanResult.dynamicBasePatterns.size} dynamic class patterns (hydration-safe mode)\n`));
    }

    // Step 6: Inject CSS (if not dry run)
    if (!dryRun) {
      console.log(chalk.gray('Injecting consolidated CSS...'));
      const cssFile = await injectConsolidatedCSS(config.buildDir, consolidatedCSS);
      console.log(chalk.green(`  ✓ Injected into ${cssFile}\n`));
    }

    // Step 7: Calculate metrics
    const cssOverhead = estimateCSSOverhead(candidates);
    const metrics = calculateMetrics(candidates, scanResult.files, transformResult, cssOverhead);

    // Step 8: Save manifest (if not dry run and manifest enabled)
    if (!dryRun && config.manifest) {
      console.log(chalk.gray('Saving manifest...'));
      const manifestPath = await saveMappingManifest(mappings, metrics, config);
      console.log(chalk.green(`  ✓ Saved to ${manifestPath}\n`));
    }

    // Print results
    printResults(metrics, dryRun);

    if (transformResult.errors.length > 0) {
      console.log(chalk.yellow('\nWarnings:'));
      for (const error of transformResult.errors) {
        console.log(chalk.yellow(`  - ${error}`));
      }
    }

  } catch (err) {
    console.error(chalk.red(`\nError: ${err}`));
    process.exit(1);
  }
}

function printResults(metrics: ReturnType<typeof calculateMetrics>, dryRun: boolean): void {
  const title = dryRun ? 'CLASSPRESSO ANALYSIS' : 'CLASSPRESSO RESULTS';
  const borderChar = '═';
  const width = 60;

  console.log(chalk.cyan(`\n╔${borderChar.repeat(width)}╗`));
  console.log(chalk.cyan(`║${' '.repeat((width - title.length) / 2)}${title}${' '.repeat((width - title.length) / 2)}║`));
  console.log(chalk.cyan(`╠${borderChar.repeat(width)}╣`));

  const lines = [
    ['Files Scanned:', metrics.totalFilesScanned.toString()],
    ['Files Modified:', metrics.totalFilesModified.toString()],
    ['', ''],
    ['CLASS ANALYSIS', ''],
    ['Total class strings:', metrics.totalClassStringsFound.toString()],
    ['Unique patterns:', metrics.uniqueClassPatterns.toString()],
    ['Consolidated:', metrics.consolidatedPatterns.toString()],
    ['', ''],
    ['SIZE IMPACT', ''],
    ['Bytes saved (JS/HTML):', formatBytes(metrics.bytesSaved)],
    ['CSS overhead:', formatBytes(metrics.consolidatedCSSBytes)],
    ['Net reduction:', `${formatBytes(metrics.bytesSaved - metrics.consolidatedCSSBytes)} (${formatPercentage(metrics.percentageReduction)})`],
    ['', ''],
    ['BROWSER IMPACT', ''],
    ['Parse time saved:', formatTime(metrics.estimatedParseTimeSavedMs)],
    ['Render time saved:', formatTime(metrics.estimatedRenderTimeSavedMs)],
  ];

  for (const [label, value] of lines) {
    if (label === '') {
      console.log(chalk.cyan(`╠${borderChar.repeat(width)}╣`));
    } else if (value === '') {
      const padding = width - label.length - 2;
      console.log(chalk.cyan(`║ ${chalk.bold(label)}${' '.repeat(padding)} ║`));
    } else {
      const padding = width - label.length - value.length - 3;
      console.log(chalk.cyan(`║ ${label}${' '.repeat(Math.max(1, padding))}${chalk.green(value)} ║`));
    }
  }

  console.log(chalk.cyan(`╠${borderChar.repeat(width)}╣`));
  console.log(chalk.cyan(`║ TOP CONSOLIDATIONS${' '.repeat(width - 20)} ║`));

  for (let i = 0; i < Math.min(5, metrics.topConsolidations.length); i++) {
    const c = metrics.topConsolidations[i];
    const line = ` ${i + 1}. ${c.consolidated} (${c.frequency}x) saves ${formatBytes(c.bytesSaved)}`;
    const padding = width - line.length - 1;
    console.log(chalk.cyan(`║${line}${' '.repeat(Math.max(1, padding))}║`));
  }

  console.log(chalk.cyan(`╚${borderChar.repeat(width)}╝\n`));
}
