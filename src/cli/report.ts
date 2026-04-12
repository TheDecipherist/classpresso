/**
 * Report Command - Generate report from manifest
 */

import chalk from 'chalk';
import { loadMappingManifest } from '../core/consolidator.js';
import { formatBytes, formatPercentage, formatTime } from '../core/metrics.js';
import { detectBuildDir, detectFrameworkHint } from '../config.js';

interface ReportOptions {
  dir?: string;
  format: 'text' | 'json' | 'html';
}

export async function reportCommand(options: ReportOptions): Promise<void> {
  // Auto-detect build directory if not specified
  let buildDir = options.dir;

  if (!buildDir) {
    const detection = await detectBuildDir();
    if (detection.detected) {
      buildDir = detection.detected;
      if (options.format !== 'json') {
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

  const manifest = await loadMappingManifest(buildDir);

  if (!manifest) {
    console.error(chalk.red('No classpresso manifest found in build directory.'));
    console.log(chalk.gray('Run "classpresso optimize" first to generate a manifest.'));
    process.exit(1);
  }

  switch (options.format) {
    case 'json':
      console.log(JSON.stringify(manifest, null, 2));
      break;

    case 'html':
      console.log(generateHTMLReport(manifest));
      break;

    case 'text':
    default:
      printTextReport(manifest);
      break;
  }
}

function printTextReport(manifest: ReturnType<typeof loadMappingManifest> extends Promise<infer T> ? NonNullable<T> : never): void {
  const { metrics } = manifest;

  console.log(chalk.cyan('\n☕ CLASSPRESSO REPORT\n'));
  console.log(chalk.gray(`Generated: ${manifest.created}`));
  console.log(chalk.gray(`Build: ${manifest.buildDir}\n`));

  console.log(chalk.bold('📊 Summary\n'));
  console.log(`  Files scanned:     ${chalk.cyan(metrics.totalFilesScanned)}`);
  console.log(`  Files modified:    ${chalk.cyan(metrics.totalFilesModified)}`);
  console.log(`  Patterns found:    ${chalk.cyan(metrics.uniqueClassPatterns)}`);
  console.log(`  Patterns applied:  ${chalk.cyan(metrics.consolidatedPatterns)}`);
  console.log();

  console.log(chalk.bold('💾 Size Impact\n'));
  console.log(`  Bytes saved:       ${chalk.green(formatBytes(metrics.bytesSaved))}`);
  console.log(`  CSS overhead:      ${chalk.yellow(formatBytes(metrics.consolidatedCSSBytes))}`);
  console.log(`  Net reduction:     ${chalk.green(formatBytes(metrics.bytesSaved - metrics.consolidatedCSSBytes))}`);
  console.log(`  Percentage:        ${chalk.green(formatPercentage(metrics.percentageReduction))}`);
  console.log();

  console.log(chalk.bold('⚡ Browser Impact\n'));
  console.log(`  Parse time saved:  ${chalk.green(formatTime(metrics.estimatedParseTimeSavedMs))}`);
  console.log(`  Render time saved: ${chalk.green(formatTime(metrics.estimatedRenderTimeSavedMs))}`);
  console.log();

  if (metrics.topConsolidations.length > 0) {
    console.log(chalk.bold('🔝 Top Consolidations\n'));
    for (let i = 0; i < metrics.topConsolidations.length; i++) {
      const c = metrics.topConsolidations[i];
      console.log(
        `  ${chalk.gray(`${i + 1}.`)} ${chalk.yellow(c.consolidated)} ` +
        `${chalk.gray('(')}${chalk.cyan(c.frequency)}x${chalk.gray(')')} ` +
        `saves ${chalk.green(formatBytes(c.bytesSaved))}`
      );
    }
    console.log();
  }

  console.log(chalk.bold('📋 All Mappings\n'));
  for (const mapping of manifest.mappings.slice(0, 20)) {
    console.log(`  ${chalk.yellow(mapping.consolidated)} ← ${chalk.gray(truncate(mapping.original, 50))}`);
  }
  if (manifest.mappings.length > 20) {
    console.log(chalk.gray(`  ... and ${manifest.mappings.length - 20} more`));
  }
  console.log();
}

function generateHTMLReport(manifest: ReturnType<typeof loadMappingManifest> extends Promise<infer T> ? NonNullable<T> : never): string {
  const { metrics } = manifest;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Classpresso Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #1a1a1a;
      color: #e0e0e0;
    }
    h1 { color: #d4af37; }
    h2 { color: #888; margin-top: 2rem; }
    .metric {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid #333;
    }
    .metric-value { color: #4ade80; font-weight: bold; }
    .mapping {
      display: flex;
      gap: 1rem;
      padding: 0.5rem;
      background: #222;
      margin: 0.25rem 0;
      border-radius: 4px;
    }
    .hash { color: #d4af37; font-family: monospace; }
    .original { color: #888; font-family: monospace; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #333; }
    th { color: #888; }
  </style>
</head>
<body>
  <h1>☕ Classpresso Report</h1>
  <p style="color: #888">Generated: ${manifest.created}</p>

  <h2>Summary</h2>
  <div class="metric"><span>Files Scanned</span><span class="metric-value">${metrics.totalFilesScanned}</span></div>
  <div class="metric"><span>Files Modified</span><span class="metric-value">${metrics.totalFilesModified}</span></div>
  <div class="metric"><span>Patterns Consolidated</span><span class="metric-value">${metrics.consolidatedPatterns}</span></div>

  <h2>Size Impact</h2>
  <div class="metric"><span>Bytes Saved</span><span class="metric-value">${formatBytes(metrics.bytesSaved)}</span></div>
  <div class="metric"><span>CSS Overhead</span><span class="metric-value">${formatBytes(metrics.consolidatedCSSBytes)}</span></div>
  <div class="metric"><span>Net Reduction</span><span class="metric-value">${formatBytes(metrics.bytesSaved - metrics.consolidatedCSSBytes)} (${formatPercentage(metrics.percentageReduction)})</span></div>

  <h2>Browser Impact</h2>
  <div class="metric"><span>Parse Time Saved</span><span class="metric-value">${formatTime(metrics.estimatedParseTimeSavedMs)}</span></div>
  <div class="metric"><span>Render Time Saved</span><span class="metric-value">${formatTime(metrics.estimatedRenderTimeSavedMs)}</span></div>

  <h2>Top Consolidations</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Hash</th><th>Frequency</th><th>Savings</th></tr>
    </thead>
    <tbody>
      ${metrics.topConsolidations.map((c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td class="hash">${c.consolidated}</td>
          <td>${c.frequency}x</td>
          <td class="metric-value">${formatBytes(c.bytesSaved)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>All Mappings</h2>
  ${manifest.mappings.map(m => `
    <div class="mapping">
      <span class="hash">${m.consolidated}</span>
      <span class="original">${escapeHtml(m.original)}</span>
    </div>
  `).join('')}
</body>
</html>`;
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
