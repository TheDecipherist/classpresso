/**
 * Analyze Command - Show potential optimizations
 */

import chalk from 'chalk';
import type { ClasspressoConfig } from '../types/index.js';
import { scanBuildOutput } from '../core/scanner.js';
import { detectConsolidatablePatterns, getPatternSummary } from '../core/pattern-detector.js';
import { formatBytes } from '../core/metrics.js';
import { loadConfig, detectBuildDir, detectFrameworkHint } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { sendErrorReport } from '../utils/error-reporter.js';

interface AnalyzeOptions {
  dir?: string;
  minOccurrences: string;
  minClasses: string;
  ssr?: boolean;
  json?: boolean;
  verbose?: boolean;
  debug?: boolean;
  sendErrorReports?: boolean;
  errorReportUrl?: string;
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  // Auto-detect build directory if not specified
  let buildDir = options.dir;

  if (!buildDir) {
    const detection = await detectBuildDir();
    if (detection.detected) {
      buildDir = detection.detected;
      if (!options.json) {
        console.log(chalk.gray(`Auto-detected build directory: ${buildDir}`));
        if (detection.suggestion) {
          console.log(chalk.yellow(detection.suggestion));
        }
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
  config.verbose = options.verbose || false;
  config.ssr = options.ssr || false;
  config.debug = options.debug || config.debug || false;
  config.sendErrorReports = options.sendErrorReports || config.sendErrorReports || false;
  config.errorReportUrl = options.errorReportUrl || config.errorReportUrl;

  // Initialize logger
  const logger = createLogger({
    debug: config.debug,
    verbose: config.verbose,
    buildDir: config.buildDir,
  });

  if (!options.json) {
    console.log(chalk.cyan('\n☕ Classpresso - Analyzing build output...\n'));
  }

  try {
    // Log system info and config
    await logger.logSystemInfo();
    await logger.logConfig(config, 'analyze command');

    // Scan build output
    const scanStartTime = Date.now();
    await logger.logStep('Starting scan', { buildDir: config.buildDir });
    const scanResult = await scanBuildOutput(config);
    await logger.logTiming('Scan', Date.now() - scanStartTime);
    await logger.logStep('Scan complete', {
      filesScanned: scanResult.files.length,
      uniquePatterns: scanResult.occurrences.size,
      errors: scanResult.errors.length,
    });

    if (scanResult.errors.length > 0 && config.verbose) {
      console.log(chalk.yellow('Warnings:'));
      for (const error of scanResult.errors) {
        console.log(chalk.yellow(`  - ${error}`));
      }
      console.log();
    }

    // Detect patterns
    const detectStartTime = Date.now();
    await logger.logStep('Detecting consolidatable patterns');
    // Pass mergeablePatterns to pattern detector in SSR mode to prevent hydration mismatches
    const candidates = detectConsolidatablePatterns(
      scanResult.occurrences,
      config,
      config.ssr ? scanResult.mergeablePatterns : undefined
    );
    const summary = getPatternSummary(candidates);
    await logger.logTiming('Pattern detection', Date.now() - detectStartTime);
    await logger.logStep('Pattern detection complete', {
      candidatesFound: candidates.length,
      totalBytesSaved: summary.totalBytesSaved,
    });

    if (options.json) {
      console.log(JSON.stringify({
        summary,
        candidates: candidates.map((c) => ({
          original: c.classString,
          hashName: c.hashName,
          frequency: c.frequency,
          bytesSaved: c.bytesSaved,
          classes: c.classes,
          excludedClasses: c.excludedClasses,
        })),
        files: scanResult.files.length,
        errors: scanResult.errors,
      }, null, 2));
      await logger.close();
      return;
    }

    // Print summary
    console.log(chalk.bold('📊 Analysis Summary\n'));
    console.log(`  Files scanned:        ${chalk.cyan(scanResult.files.length)}`);
    console.log(`  Unique patterns:      ${chalk.cyan(summary.totalPatterns)}`);
    console.log(`  Total occurrences:    ${chalk.cyan(summary.totalOccurrences)}`);
    console.log(`  Avg. frequency:       ${chalk.cyan(summary.avgFrequency.toFixed(1))}`);
    console.log(`  Avg. classes/pattern: ${chalk.cyan(summary.avgClassesPerPattern.toFixed(1))}`);
    console.log();

    console.log(chalk.bold('💰 Potential Savings\n'));
    console.log(`  Patterns to consolidate: ${chalk.green(summary.totalPatterns)}`);
    console.log(`  Estimated savings:       ${chalk.green(formatBytes(summary.totalBytesSaved))}`);
    console.log();

    if (candidates.length > 0) {
      console.log(chalk.bold('🔝 Top 10 Consolidation Candidates\n'));

      const top10 = candidates.slice(0, 10);
      for (let i = 0; i < top10.length; i++) {
        const c = top10[i];
        console.log(
          `  ${chalk.gray(`${i + 1}.`)} ${chalk.yellow(c.hashName)} ` +
          `${chalk.gray('(')}${chalk.cyan(c.frequency)}x${chalk.gray(')')} ` +
          `saves ${chalk.green(formatBytes(c.bytesSaved))}`
        );
        console.log(`     ${chalk.gray(truncate(c.classString, 60))}`);
        if (c.excludedClasses.length > 0) {
          console.log(`     ${chalk.gray('excluded:')} ${chalk.yellow(c.excludedClasses.join(' '))}`);
        }
      }
      console.log();
    }

    if (candidates.length === 0) {
      console.log(chalk.yellow('No patterns found that meet the consolidation criteria.'));
      console.log(chalk.gray('Try lowering --min-occurrences or --min-classes'));
    } else {
      console.log(chalk.gray(`Run ${chalk.cyan('classpresso optimize')} to apply these optimizations.`));
    }

    // Show debug log location if debug mode is enabled
    if (config.debug && logger.getLogPath()) {
      console.log(chalk.gray(`Debug log: ${logger.getLogPath()}`));
    }

    console.log();
    await logger.close();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logger.logError(error, 'analyze command');
    await logger.close();

    // Send error report if enabled
    if (config.sendErrorReports) {
      await sendErrorReport(error, {
        enabled: true,
        url: config.errorReportUrl,
      }, config, 'analyze');
    }

    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
