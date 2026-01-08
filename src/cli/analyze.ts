/**
 * Analyze Command - Show potential optimizations
 */

import chalk from 'chalk';
import type { ClasspressoConfig } from '../types/index.js';
import { scanBuildOutput } from '../core/scanner.js';
import { detectConsolidatablePatterns, getPatternSummary } from '../core/pattern-detector.js';
import { formatBytes } from '../core/metrics.js';
import { loadConfig } from '../config.js';

interface AnalyzeOptions {
  dir: string;
  minOccurrences: string;
  minClasses: string;
  ssr?: boolean;
  json?: boolean;
  verbose?: boolean;
}

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const config = await loadConfig(options.dir);

  // Override config with CLI options
  config.minOccurrences = parseInt(options.minOccurrences, 10);
  config.minClasses = parseInt(options.minClasses, 10);
  config.verbose = options.verbose || false;
  config.ssr = options.ssr || false;

  if (!options.json) {
    console.log(chalk.cyan('\n☕ Classpresso - Analyzing build output...\n'));
  }

  try {
    // Scan build output
    const scanResult = await scanBuildOutput(config);

    if (scanResult.errors.length > 0 && config.verbose) {
      console.log(chalk.yellow('Warnings:'));
      for (const error of scanResult.errors) {
        console.log(chalk.yellow(`  - ${error}`));
      }
      console.log();
    }

    // Detect patterns
    const candidates = detectConsolidatablePatterns(scanResult.occurrences, config);
    const summary = getPatternSummary(candidates);

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

    console.log();
  } catch (err) {
    console.error(chalk.red(`Error: ${err}`));
    process.exit(1);
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
