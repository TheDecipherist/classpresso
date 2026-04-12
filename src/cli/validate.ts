/**
 * Validate Command - Check for hydration safety issues
 */

import chalk from 'chalk';
import type { ClasspressoConfig, ClassOccurrence } from '../types/index.js';
import { scanBuildOutput, isHydrationSafe } from '../core/scanner.js';
import { loadConfig, detectBuildDir, detectFrameworkHint } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { sendErrorReport } from '../utils/error-reporter.js';

interface ValidateOptions {
  dir?: string;
  hydration?: boolean;
  json?: boolean;
  verbose?: boolean;
  debug?: boolean;
  sendErrorReports?: boolean;
  errorReportUrl?: string;
}

interface HydrationIssue {
  pattern: string;
  classes: string[];
  status: 'server-only' | 'client-only' | 'mergeable';
  locations: Array<{ file: string; line?: number }>;
  explanation: string;
  fix: string;
}

/**
 * Analyze a pattern and determine its hydration status
 */
function analyzeHydrationStatus(occurrence: ClassOccurrence): HydrationIssue | null {
  const hasServer = occurrence.sourceTypes.has('html') || occurrence.sourceTypes.has('rsc');
  const hasClient = occurrence.sourceTypes.has('js');

  // If it appears in both, it's safe
  if (hasServer && hasClient) {
    return null;
  }

  // Server-only pattern
  if (hasServer && !hasClient) {
    return {
      pattern: occurrence.classString,
      classes: occurrence.classes,
      status: 'server-only',
      locations: occurrence.locations.map(loc => ({
        file: loc.filePath,
        line: loc.line,
      })),
      explanation: 'This pattern only appears in server-rendered HTML/RSC, not in client-side JavaScript.',
      fix: 'If this is a static element, this is fine. If it\'s inside a client component, ensure the className is in your JS bundle.',
    };
  }

  // Client-only pattern
  if (!hasServer && hasClient) {
    return {
      pattern: occurrence.classString,
      classes: occurrence.classes,
      status: 'client-only',
      locations: occurrence.locations.map(loc => ({
        file: loc.filePath,
        line: loc.line,
      })),
      explanation: 'This pattern only appears in client JavaScript, not in server-rendered HTML.',
      fix: 'This may be a dynamically added className or a client-only component. React will hydrate it correctly, but Classpresso cannot consolidate it safely.',
    };
  }

  return null;
}

export async function validateCommand(options: ValidateOptions): Promise<void> {
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
      // Try framework hint
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

  // Initialize logger
  const logger = createLogger({
    debug: config.debug,
    verbose: config.verbose,
    buildDir: config.buildDir,
  });

  if (!options.json) {
    console.log(chalk.cyan('\n☕ Classpresso - Hydration Safety Validator\n'));
  }

  try {
    await logger.logSystemInfo();
    await logger.logConfig(config, 'validate command');

    // Scan build output
    const scanStartTime = Date.now();
    await logger.logStep('Scanning build output', { buildDir: config.buildDir });
    const scanResult = await scanBuildOutput(config);
    await logger.logTiming('Scan', Date.now() - scanStartTime);

    // Analyze each pattern for hydration safety
    const issues: HydrationIssue[] = [];
    const safePatterns: ClassOccurrence[] = [];

    for (const [, occurrence] of scanResult.occurrences) {
      // Skip single occurrences (not worth reporting)
      if (occurrence.count < 2) continue;

      const issue = analyzeHydrationStatus(occurrence);
      if (issue) {
        issues.push(issue);
      } else {
        safePatterns.push(occurrence);
      }
    }

    // Also check mergeable patterns (these can cause hydration issues)
    const mergeableIssues: HydrationIssue[] = [];
    for (const pattern of scanResult.mergeablePatterns) {
      const occurrence = scanResult.occurrences.get(pattern);
      if (occurrence) {
        mergeableIssues.push({
          pattern: occurrence.classString,
          classes: occurrence.classes,
          status: 'mergeable',
          locations: occurrence.locations.map(loc => ({
            file: loc.filePath,
            line: loc.line,
          })),
          explanation: 'This pattern appears to be a className prop that gets merged with component classes at runtime.',
          fix: 'This is expected behavior for component composition. Classpresso will skip this pattern in SSR mode to prevent mismatches.',
        });
      }
    }

    // JSON output
    if (options.json) {
      console.log(JSON.stringify({
        summary: {
          totalPatterns: scanResult.occurrences.size,
          safePatterns: safePatterns.length,
          serverOnlyPatterns: issues.filter(i => i.status === 'server-only').length,
          clientOnlyPatterns: issues.filter(i => i.status === 'client-only').length,
          mergeablePatterns: mergeableIssues.length,
        },
        issues: [...issues, ...mergeableIssues],
        safePatterns: safePatterns.map(p => ({
          pattern: p.classString,
          frequency: p.count,
          classes: p.classes,
        })),
      }, null, 2));
      await logger.close();
      return;
    }

    // Text output
    const serverOnly = issues.filter(i => i.status === 'server-only');
    const clientOnly = issues.filter(i => i.status === 'client-only');

    console.log(chalk.bold('📊 Hydration Safety Summary\n'));
    console.log(`  Patterns analyzed:    ${chalk.cyan(scanResult.occurrences.size)}`);
    console.log(`  Hydration-safe:       ${chalk.green(safePatterns.length)}`);
    console.log(`  Server-only:          ${chalk.yellow(serverOnly.length)}`);
    console.log(`  Client-only:          ${chalk.yellow(clientOnly.length)}`);
    console.log(`  Mergeable (props):    ${chalk.gray(mergeableIssues.length)}`);
    console.log();

    // Show issues if any
    if (issues.length > 0) {
      console.log(chalk.bold.yellow(`⚠️  Found ${issues.length} patterns that may cause hydration issues:\n`));

      let count = 0;
      for (const issue of issues.slice(0, 10)) {
        count++;
        const statusColor = issue.status === 'server-only' ? chalk.magenta : chalk.blue;
        const statusLabel = issue.status === 'server-only' ? 'SERVER-ONLY' : 'CLIENT-ONLY';

        console.log(`  ${chalk.gray(`${count}.`)} ${chalk.white(`"${truncate(issue.pattern, 50)}"`)}`)
        console.log(`     Status: ${statusColor(statusLabel)}`);

        // Show first location
        if (issue.locations.length > 0) {
          const loc = issue.locations[0];
          const locStr = loc.line ? `${loc.file}:${loc.line}` : loc.file;
          console.log(`     Location: ${chalk.gray(truncate(locStr, 60))}`);
          if (issue.locations.length > 1) {
            console.log(`     ${chalk.gray(`+ ${issue.locations.length - 1} more locations`)}`);
          }
        }

        console.log(`     ${chalk.gray('Fix:')} ${issue.fix}`);
        console.log();
      }

      if (issues.length > 10) {
        console.log(chalk.gray(`  ... and ${issues.length - 10} more patterns\n`));
      }
    }

    // Recommendations
    console.log(chalk.bold('💡 Recommendations\n'));

    if (issues.length === 0) {
      console.log(chalk.green('  ✅ All patterns are hydration-safe!'));
      console.log(chalk.gray('     You can safely run "classpresso optimize" without the --ssr flag.'));
    } else if (serverOnly.length > 0 && clientOnly.length > 0) {
      console.log(chalk.yellow('  ⚠️  Mixed server/client patterns detected.'));
      console.log(chalk.gray('     Use "classpresso optimize --ssr" to only consolidate safe patterns.'));
    } else if (serverOnly.length > 0) {
      console.log(chalk.yellow('  ⚠️  Some patterns only appear in server-rendered HTML.'));
      console.log(chalk.gray('     These are typically static content. Use --ssr for safety.'));
    } else if (clientOnly.length > 0) {
      console.log(chalk.yellow('  ⚠️  Some patterns only appear in client JavaScript.'));
      console.log(chalk.gray('     These may be dynamically applied classes. Use --ssr for safety.'));
    }

    if (mergeableIssues.length > 0 && options.verbose) {
      console.log();
      console.log(chalk.gray(`  Note: ${mergeableIssues.length} patterns are className props that merge with component classes.`));
      console.log(chalk.gray('     These are automatically handled by the --ssr flag.'));
    }

    console.log();

    // Show debug log location if debug mode is enabled
    if (config.debug && logger.getLogPath()) {
      console.log(chalk.gray(`Debug log: ${logger.getLogPath()}`));
    }

    await logger.close();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    await logger.logError(error, 'validate command');
    await logger.close();

    // Send error report if enabled
    if (config.sendErrorReports) {
      await sendErrorReport(error, {
        enabled: true,
        url: config.errorReportUrl,
      }, config, 'validate');
    }

    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
