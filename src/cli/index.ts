/**
 * Classpresso CLI
 */

import { Command } from 'commander';
import { analyzeCommand } from './analyze.js';
import { optimizeCommand } from './optimize.js';
import { reportCommand } from './report.js';
import { validateCommand } from './validate.js';
import { unusedCommand } from './unused.js';
import { getVersion } from '../utils/logger.js';

const program = new Command();

program
  .name('classpresso')
  .description('CSS class consolidation tool - compress multiple utility classes into single optimized classes')
  .version(getVersion());

program
  .command('analyze')
  .description('Analyze build output and show potential optimizations')
  .option('-d, --dir <path>', 'Build directory (auto-detected if not specified)')
  .option('--min-occurrences <n>', 'Minimum occurrences to consolidate', '2')
  .option('--min-classes <n>', 'Minimum classes in pattern', '2')
  .option('--ssr', 'Enable SSR-safe mode (only transforms patterns in both HTML and JS)')
  .option('--json', 'Output as JSON')
  .option('-v, --verbose', 'Verbose output')
  .option('--debug', 'Enable debug mode (generates detailed log file)')
  .option('--send-error-reports', 'Send error reports to configured webhook')
  .option('--error-report-url <url>', 'Webhook URL for error reports')
  .action(analyzeCommand);

program
  .command('optimize')
  .description('Optimize build output by consolidating classes')
  .option('-d, --dir <path>', 'Build directory (auto-detected if not specified)')
  .option('--min-occurrences <n>', 'Minimum occurrences to consolidate', '2')
  .option('--min-classes <n>', 'Minimum classes in pattern', '2')
  .option('--ssr', 'Enable SSR-safe mode (only transforms patterns in both HTML and JS)')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('--backup', 'Create backup before modifying')
  .option('--no-manifest', 'Do not generate manifest file')
  .option('--purge-unused', 'Remove unused CSS classes after consolidation')
  .option('-v, --verbose', 'Verbose output')
  .option('--debug', 'Enable debug mode (generates detailed log file)')
  .option('--send-error-reports', 'Send error reports to configured webhook')
  .option('--error-report-url <url>', 'Webhook URL for error reports')
  .action(optimizeCommand);

program
  .command('report')
  .description('Generate report from existing manifest')
  .option('-d, --dir <path>', 'Build directory (auto-detected if not specified)')
  .option('--format <type>', 'Output format: text, json, html', 'text')
  .action(reportCommand);

program
  .command('validate')
  .description('Check for hydration safety issues in class patterns')
  .option('-d, --dir <path>', 'Build directory (auto-detected if not specified)')
  .option('--hydration', 'Check hydration safety (default)', true)
  .option('--json', 'Output as JSON')
  .option('-v, --verbose', 'Verbose output')
  .option('--debug', 'Enable debug mode (generates detailed log file)')
  .option('--send-error-reports', 'Send error reports to configured webhook')
  .option('--error-report-url <url>', 'Webhook URL for error reports')
  .action(validateCommand);

program
  .command('unused')
  .description('Analyze CSS for unused classes')
  .option('-d, --dir <path>', 'Build directory (auto-detected if not specified)')
  .option('--json', 'Output as JSON')
  .option('--limit <n>', 'Number of top unused classes to show', '20')
  .option('-v, --verbose', 'Verbose output (show file breakdown)')
  .option('--debug', 'Enable debug mode (generates detailed log file)')
  .option('--send-error-reports', 'Send error reports to configured webhook')
  .option('--error-report-url <url>', 'Webhook URL for error reports')
  .action(unusedCommand);

export { program };
