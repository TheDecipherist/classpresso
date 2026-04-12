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
import { purgeUnusedCSS } from '../core/css-purger.js';
import { calculateMetrics, estimateCSSOverhead, formatBytes, formatPercentage, formatTime } from '../core/metrics.js';
import { loadConfig, detectBuildDir, detectFrameworkHint } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { sendErrorReport } from '../utils/error-reporter.js';

interface OptimizeOptions {
  dir?: string;
  minOccurrences: string;
  minClasses: string;
  ssr?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  manifest?: boolean;
  purgeUnused?: boolean;
  verbose?: boolean;
  debug?: boolean;
  sendErrorReports?: boolean;
  errorReportUrl?: string;
}

export async function optimizeCommand(options: OptimizeOptions): Promise<void> {
  // Auto-detect build directory if not specified
  let buildDir = options.dir;

  if (!buildDir) {
    const detection = await detectBuildDir();
    if (detection.detected) {
      buildDir = detection.detected;
      console.log(chalk.gray(`Auto-detected build directory: ${buildDir}`));
      if (detection.suggestion) {
        console.log(chalk.yellow(detection.suggestion));
      }
    } else {
      const hint = await detectFrameworkHint();
      if (hint) {
        console.error(chalk.red(`No build directory found.`));
        console.log(chalk.yellow(`Detected ${hint.name} project. Expected build directory: ${hint.buildDir}`));
        console.log(chalk.gray(`Run your build command first, then try again.`));
      } else {
        console.error(chalk.red('No build directory found and could not auto-detect.'));
        console.log(chalk.gray('Use --dir to specify your build directory, or run your build command first.'));
      }
      process.exit(1);
    }
  }

  const config = await loadConfig(buildDir);

  // Override config with CLI options
  config.minOccurrences = parseInt(options.minOccurrences, 10);
  config.minClasses = parseInt(options.minClasses, 10);
  config.ssr = options.ssr || false;
  config.backup = options.backup || false;
  config.manifest = options.manifest !== false;
  config.verbose = options.verbose || false;
  config.debug = options.debug || config.debug || false;
  config.sendErrorReports = options.sendErrorReports || config.sendErrorReports || false;
  config.errorReportUrl = options.errorReportUrl || config.errorReportUrl;
  config.purgeUnusedCSS = options.purgeUnused || config.purgeUnusedCSS || false;

  const dryRun = options.dryRun || false;

  // Initialize logger
  const logger = createLogger({
    debug: config.debug,
    verbose: config.verbose,
    buildDir: config.buildDir,
  });

  console.log(chalk.cyan('\n☕ Classpresso - Optimizing build output...\n'));

  if (dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No files will be modified\n'));
  }

  if (config.ssr) {
    console.log(chalk.blue('🔒 SSR MODE - Only transforming patterns found in both HTML and JS\n'));
  }

  try {
    // Log system info and config
    await logger.logSystemInfo();
    await logger.logConfig(config, 'optimize command');

    // Step 1: Scan
    console.log(chalk.gray('Scanning build output...'));
    const scanStartTime = Date.now();
    await logger.logStep('Starting scan', { buildDir: config.buildDir, dryRun });
    const scanResult = await scanBuildOutput(config);
    await logger.logTiming('Scan', Date.now() - scanStartTime);
    await logger.logStep('Scan complete', {
      filesScanned: scanResult.files.length,
      uniquePatterns: scanResult.occurrences.size,
      errors: scanResult.errors.length,
    });
    console.log(chalk.green(`  ✓ Scanned ${scanResult.files.length} files\n`));

    // Step 2: Detect patterns
    console.log(chalk.gray('Detecting patterns...'));
    const detectStartTime = Date.now();
    await logger.logStep('Detecting patterns');
    // Pass mergeablePatterns to pattern detector in SSR mode to prevent hydration mismatches
    const candidates = detectConsolidatablePatterns(
      scanResult.occurrences,
      config,
      config.ssr ? scanResult.mergeablePatterns : undefined
    );
    await logger.logTiming('Pattern detection', Date.now() - detectStartTime);
    await logger.logStep('Pattern detection complete', { candidatesFound: candidates.length });
    console.log(chalk.green(`  ✓ Found ${candidates.length} patterns to consolidate\n`));

    if (candidates.length === 0) {
      console.log(chalk.yellow('No patterns found that meet the consolidation criteria.'));
      console.log(chalk.gray('Try lowering --min-occurrences or --min-classes\n'));
      await logger.logStep('No patterns to consolidate - exiting');
      await logger.close();
      return;
    }

    // Step 3: Create mappings
    console.log(chalk.gray('Creating class mappings...'));
    const mappingStartTime = Date.now();
    await logger.logStep('Creating class mappings');
    const mappings = createClassMappings(candidates);
    await logger.logTiming('Mapping creation', Date.now() - mappingStartTime);
    await logger.logStep('Mappings created', { mappingCount: mappings.length });
    console.log(chalk.green(`  ✓ Created ${mappings.length} mappings\n`));

    // Step 4: Generate CSS
    console.log(chalk.gray('Generating consolidated CSS...'));
    const cssStartTime = Date.now();
    await logger.logStep('Generating consolidated CSS');
    const consolidatedCSS = await generateConsolidatedCSS(mappings, config.buildDir, config.cssLayer);
    const cssBytes = Buffer.byteLength(consolidatedCSS, 'utf-8');
    await logger.logTiming('CSS generation', Date.now() - cssStartTime);
    await logger.logStep('CSS generated', { cssBytes });
    console.log(chalk.green(`  ✓ Generated ${formatBytes(cssBytes)} of CSS\n`));

    // Step 5: Transform build output
    console.log(chalk.gray('Transforming build output...'));
    const transformStartTime = Date.now();
    await logger.logStep('Transforming build output', { dryRun });
    const transformResult = await transformBuildOutput(
      mappings,
      config,
      dryRun,
      scanResult.dynamicBasePatterns,
      scanResult.mergeablePatterns
    );
    await logger.logTiming('Transformation', Date.now() - transformStartTime);
    await logger.logStep('Transformation complete', {
      filesModified: transformResult.filesModified,
      bytesChanged: transformResult.bytesChanged,
      errors: transformResult.errors.length,
    });
    console.log(chalk.green(`  ✓ Modified ${transformResult.filesModified} files\n`));

    if (config.verbose) {
      if (scanResult.dynamicBasePatterns.size > 0) {
        console.log(chalk.gray(`  ℹ Found ${scanResult.dynamicBasePatterns.size} dynamic class patterns (template literals)\n`));
      }
      if (scanResult.mergeablePatterns.size > 0) {
        console.log(chalk.gray(`  ℹ Found ${scanResult.mergeablePatterns.size} mergeable patterns (className props)\n`));
      }
    }

    // Step 6: Inject CSS (if not dry run)
    if (!dryRun) {
      console.log(chalk.gray('Injecting consolidated CSS...'));
      const injectStartTime = Date.now();
      await logger.logStep('Injecting consolidated CSS');
      const cssFile = await injectConsolidatedCSS(config.buildDir, consolidatedCSS);
      await logger.logTiming('CSS injection', Date.now() - injectStartTime);
      await logger.logStep('CSS injected', { cssFile });
      console.log(chalk.green(`  ✓ Injected into ${cssFile}\n`));
    }

    // Step 7: Purge unused CSS (if enabled and not dry run)
    let purgeBytesSaved = 0;
    if (config.purgeUnusedCSS && !dryRun) {
      console.log(chalk.gray('Purging unused CSS...'));
      const purgeStartTime = Date.now();
      await logger.logStep('Purging unused CSS');
      const purgeResult = await purgeUnusedCSS(config.buildDir, mappings, config);
      await logger.logTiming('CSS purge', Date.now() - purgeStartTime);
      await logger.logStep('CSS purge complete', {
        rulesRemoved: purgeResult.rulesRemoved,
        bytesSaved: purgeResult.bytesSaved,
      });
      purgeBytesSaved = purgeResult.bytesSaved;
      console.log(chalk.green(`  ✓ Purged ${purgeResult.rulesRemoved} unused CSS rules (${formatBytes(purgeResult.bytesSaved)} saved)\n`));

      if (purgeResult.errors.length > 0 && config.verbose) {
        for (const error of purgeResult.errors) {
          console.log(chalk.yellow(`  ⚠ ${error}`));
        }
      }
    }

    // Step 8: Calculate metrics
    await logger.logStep('Calculating metrics');
    const cssOverhead = estimateCSSOverhead(candidates);
    const metrics = calculateMetrics(candidates, scanResult.files, transformResult, cssOverhead);
    await logger.logStep('Metrics calculated', {
      bytesSaved: metrics.bytesSaved,
      percentageReduction: metrics.percentageReduction,
    });

    // Step 9: Save manifest (if not dry run and manifest enabled)
    if (!dryRun && config.manifest) {
      console.log(chalk.gray('Saving manifest...'));
      await logger.logStep('Saving manifest');
      const manifestPath = await saveMappingManifest(mappings, metrics, config);
      await logger.logStep('Manifest saved', { manifestPath });
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

    // Show debug log location if debug mode is enabled
    if (config.debug && logger.getLogPath()) {
      console.log(chalk.gray(`Debug log: ${logger.getLogPath()}`));
    }

    await logger.close();

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logger.logError(error, 'optimize command');
    await logger.close();

    // Send error report if enabled
    if (config.sendErrorReports) {
      await sendErrorReport(error, {
        enabled: true,
        url: config.errorReportUrl,
      }, config, 'optimize');
    }

    console.error(chalk.red(`\nError: ${error.message}`));
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
