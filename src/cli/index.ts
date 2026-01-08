/**
 * Classpresso CLI
 */

import { Command } from 'commander';
import { analyzeCommand } from './analyze.js';
import { optimizeCommand } from './optimize.js';
import { reportCommand } from './report.js';

const program = new Command();

program
  .name('classpresso')
  .description('CSS class consolidation tool - compress multiple utility classes into single optimized classes')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze build output and show potential optimizations')
  .option('-d, --dir <path>', 'Build directory', '.next')
  .option('--min-occurrences <n>', 'Minimum occurrences to consolidate', '2')
  .option('--min-classes <n>', 'Minimum classes in pattern', '2')
  .option('--ssr', 'Enable SSR-safe mode (only transforms patterns in both HTML and JS)')
  .option('--json', 'Output as JSON')
  .option('-v, --verbose', 'Verbose output')
  .action(analyzeCommand);

program
  .command('optimize')
  .description('Optimize build output by consolidating classes')
  .option('-d, --dir <path>', 'Build directory', '.next')
  .option('--min-occurrences <n>', 'Minimum occurrences to consolidate', '2')
  .option('--min-classes <n>', 'Minimum classes in pattern', '2')
  .option('--ssr', 'Enable SSR-safe mode (only transforms patterns in both HTML and JS)')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('--backup', 'Create backup before modifying')
  .option('--no-manifest', 'Do not generate manifest file')
  .option('-v, --verbose', 'Verbose output')
  .action(optimizeCommand);

program
  .command('report')
  .description('Generate report from existing manifest')
  .option('-d, --dir <path>', 'Build directory', '.next')
  .option('--format <type>', 'Output format: text, json, html', 'text')
  .action(reportCommand);

export { program };
