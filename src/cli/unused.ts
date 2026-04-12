/**
 * Unused Command - Analyze unused CSS classes
 */

import chalk from 'chalk';
import postcss from 'postcss';
import type { ClasspressoConfig } from '../types/index.js';
import { extractUsedClasses } from '../core/css-purger.js';
import { loadConfig, detectBuildDir, detectFrameworkHint } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { sendErrorReport } from '../utils/error-reporter.js';
import { findFiles, readFileContent, isCSSFile } from '../utils/files.js';
import { formatBytes } from '../core/metrics.js';

interface UnusedOptions {
  dir?: string;
  json?: boolean;
  verbose?: boolean;
  debug?: boolean;
  limit?: string;
  sendErrorReports?: boolean;
  errorReportUrl?: string;
}

interface UnusedClass {
  className: string;
  selector: string;
  bytes: number;
  file: string;
}

interface UnusedReport {
  summary: {
    cssFilesScanned: number;
    totalCSSRules: number;
    usedClasses: number;
    unusedClasses: number;
    unusedBytes: number;
    estimatedGzipSavings: number;
  };
  unusedClasses: UnusedClass[];
  topUnused: UnusedClass[];
}

/**
 * CSS file patterns for all supported frameworks
 */
const CSS_PATTERNS = [
  'static/**/*.css',
  'static/css/**/*.css',
  'standalone/.next/static/**/*.css',
  'browser/**/*.css',
  '_astro/**/*.css',
  'client/_astro/**/*.css',
  'public/_nuxt/**/*.css',
  '_app/**/*.css',
  'client/**/*.css',
  'assets/**/*.css',
  '**/*.css',
];

/**
 * Extract class name from a CSS selector
 */
function extractClassFromSelector(selector: string): string | null {
  const match = selector.match(/^\.([^\s:,\[]+)/);
  if (match) {
    return match[1].replace(/\\/g, '');
  }
  return null;
}

/**
 * Check if a class is a responsive or state variant
 */
function isVariantClass(className: string): boolean {
  const variantPrefixes = [
    'sm:', 'md:', 'lg:', 'xl:', '2xl:',
    'hover:', 'focus:', 'active:', 'disabled:', 'group-hover:',
    'dark:', 'light:',
    'first:', 'last:', 'odd:', 'even:',
    'before:', 'after:',
  ];
  return variantPrefixes.some(prefix => className.includes(prefix.replace(':', '\\:')));
}

/**
 * Analyze CSS files to find unused classes
 */
async function analyzeUnusedCSS(
  buildDir: string,
  config: ClasspressoConfig
): Promise<UnusedReport> {
  const report: UnusedReport = {
    summary: {
      cssFilesScanned: 0,
      totalCSSRules: 0,
      usedClasses: 0,
      unusedClasses: 0,
      unusedBytes: 0,
      estimatedGzipSavings: 0,
    },
    unusedClasses: [],
    topUnused: [],
  };

  // Step 1: Extract all used classes from HTML/JS
  const usedClasses = await extractUsedClasses(buildDir);
  report.summary.usedClasses = usedClasses.size;

  // Step 2: Find CSS files
  const cssFiles = await findFiles(buildDir, CSS_PATTERNS);

  // Step 3: Analyze each CSS file
  const seenClasses = new Set<string>();

  for (const cssFile of cssFiles) {
    if (!isCSSFile(cssFile)) continue;

    try {
      const content = await readFileContent(cssFile);
      const root = postcss.parse(content);

      report.summary.cssFilesScanned++;

      root.walkRules((rule) => {
        report.summary.totalCSSRules++;

        const className = extractClassFromSelector(rule.selector);
        if (!className) return;

        // Skip already seen classes
        if (seenClasses.has(className)) return;
        seenClasses.add(className);

        // Skip if used
        if (usedClasses.has(className)) return;

        // Skip variant classes (might be dynamically applied)
        if (isVariantClass(className)) return;

        // Skip consolidated classes
        if (className.startsWith(config.hashPrefix)) return;

        // Skip safelisted classes
        if (config.purgeSafelist) {
          const isSafelisted = config.purgeSafelist.some(pattern => {
            if (typeof pattern === 'string') {
              return className === pattern;
            } else if (pattern instanceof RegExp) {
              return pattern.test(className);
            }
            return false;
          });
          if (isSafelisted) return;
        }

        // Calculate bytes for this rule
        const ruleBytes = Buffer.byteLength(rule.toString(), 'utf-8');

        report.unusedClasses.push({
          className,
          selector: rule.selector,
          bytes: ruleBytes,
          file: cssFile,
        });

        report.summary.unusedClasses++;
        report.summary.unusedBytes += ruleBytes;
      });
    } catch {
      // Skip files that can't be parsed
    }
  }

  // Sort by bytes descending and get top unused
  report.unusedClasses.sort((a, b) => b.bytes - a.bytes);
  report.topUnused = report.unusedClasses.slice(0, 20);

  // Estimate gzip savings (roughly 30% of original for CSS)
  report.summary.estimatedGzipSavings = Math.round(report.summary.unusedBytes * 0.3);

  return report;
}

export async function unusedCommand(options: UnusedOptions): Promise<void> {
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
  config.verbose = options.verbose || false;
  config.debug = options.debug || config.debug || false;
  config.sendErrorReports = options.sendErrorReports || config.sendErrorReports || false;
  config.errorReportUrl = options.errorReportUrl || config.errorReportUrl;

  const limit = parseInt(options.limit || '20', 10);

  // Initialize logger
  const logger = createLogger({
    debug: config.debug,
    verbose: config.verbose,
    buildDir: config.buildDir,
  });

  if (!options.json) {
    console.log(chalk.cyan('\n☕ Classpresso - Unused CSS Analyzer\n'));
  }

  try {
    await logger.logSystemInfo();
    await logger.logConfig(config, 'unused command');

    // Analyze unused CSS
    const analyzeStartTime = Date.now();
    await logger.logStep('Analyzing CSS usage', { buildDir: config.buildDir });
    const report = await analyzeUnusedCSS(config.buildDir, config);
    await logger.logTiming('Analysis', Date.now() - analyzeStartTime);

    // JSON output
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      await logger.close();
      return;
    }

    // Text output
    console.log(chalk.bold('📊 Summary\n'));
    console.log(`  CSS files scanned:    ${chalk.cyan(report.summary.cssFilesScanned)}`);
    console.log(`  Total CSS rules:      ${chalk.cyan(report.summary.totalCSSRules)}`);
    console.log(`  Classes used:         ${chalk.green(report.summary.usedClasses)}`);
    console.log(`  Classes unused:       ${chalk.yellow(report.summary.unusedClasses)}`);
    console.log();

    console.log(chalk.bold('💾 Size Impact\n'));
    console.log(`  Unused CSS bytes:     ${chalk.yellow(formatBytes(report.summary.unusedBytes))}`);
    console.log(`  Gzip estimate:        ${chalk.yellow(formatBytes(report.summary.estimatedGzipSavings))}`);
    console.log();

    if (report.unusedClasses.length > 0) {
      console.log(chalk.bold(`🔝 Top ${Math.min(limit, report.unusedClasses.length)} Unused Classes (by size)\n`));

      const topClasses = report.unusedClasses.slice(0, limit);
      for (let i = 0; i < topClasses.length; i++) {
        const cls = topClasses[i];
        console.log(
          `  ${chalk.gray(`${i + 1}.`.padStart(4))} ${chalk.yellow(truncate(cls.className, 40).padEnd(42))} ` +
          `${chalk.cyan(formatBytes(cls.bytes).padStart(10))}`
        );
      }

      if (report.unusedClasses.length > limit) {
        console.log(chalk.gray(`\n  ... and ${report.unusedClasses.length - limit} more unused classes`));
      }
      console.log();
    }

    // Recommendations
    console.log(chalk.bold('💡 Recommendations\n'));

    if (report.summary.unusedClasses === 0) {
      console.log(chalk.green('  ✅ No unused CSS classes found!'));
      console.log(chalk.gray('     Your CSS is well-optimized.'));
    } else if (report.summary.unusedBytes > 10000) {
      console.log(chalk.yellow(`  ⚠️  Found ${formatBytes(report.summary.unusedBytes)} of unused CSS.`));
      console.log(chalk.gray('     Run "classpresso optimize --purge-unused" to remove these classes.'));
    } else if (report.summary.unusedBytes > 1000) {
      console.log(chalk.yellow(`  Found ${formatBytes(report.summary.unusedBytes)} of unused CSS.`));
      console.log(chalk.gray('     Consider using "classpresso optimize --purge-unused" to remove these.'));
    } else {
      console.log(chalk.green(`  Found only ${formatBytes(report.summary.unusedBytes)} of unused CSS.`));
      console.log(chalk.gray('     This is minimal - purging is optional.'));
    }

    console.log();

    // Verbose mode: show file breakdown
    if (options.verbose && report.unusedClasses.length > 0) {
      const fileBreakdown = new Map<string, number>();
      for (const cls of report.unusedClasses) {
        const current = fileBreakdown.get(cls.file) || 0;
        fileBreakdown.set(cls.file, current + cls.bytes);
      }

      console.log(chalk.bold('📁 Breakdown by File\n'));
      const sortedFiles = [...fileBreakdown.entries()].sort((a, b) => b[1] - a[1]);
      for (const [file, bytes] of sortedFiles.slice(0, 10)) {
        const shortPath = file.replace(config.buildDir, '').replace(/^\//, '');
        console.log(`  ${chalk.gray(truncate(shortPath, 50).padEnd(52))} ${chalk.cyan(formatBytes(bytes))}`);
      }
      console.log();
    }

    // Show debug log location if debug mode is enabled
    if (config.debug && logger.getLogPath()) {
      console.log(chalk.gray(`Debug log: ${logger.getLogPath()}`));
    }

    await logger.close();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logger.logError(error, 'unused command');
    await logger.close();

    // Send error report if enabled
    if (config.sendErrorReports) {
      await sendErrorReport(error, {
        enabled: true,
        url: config.errorReportUrl,
      }, config, 'unused');
    }

    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
