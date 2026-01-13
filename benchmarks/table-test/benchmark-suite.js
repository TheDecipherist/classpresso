/**
 * Classpresso Comprehensive Benchmark Suite
 *
 * Tests 10 different table sizes: 100-1000 rows
 * Compares baseline vs classpresso --purge-unused
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const URL = `http://localhost:${PORT}`;
const COLS = 20;
const ROW_CONFIGS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
const RUNS_PER_TEST = 3;
const CPU_THROTTLE = 4;

let server = null;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateTable(rows) {
  const cellPatterns = [
    'px-4 py-2 text-sm text-gray-700 bg-white border-b border-gray-200',
    'px-4 py-2 text-sm text-gray-900 bg-gray-50 border-b border-gray-200',
    'px-4 py-2 text-sm font-medium text-gray-700 bg-white border-b border-gray-200',
    'px-4 py-2 text-sm text-blue-600 bg-white border-b border-gray-200 hover:text-blue-800',
  ];
  const headerPattern = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100 border-b border-gray-300';
  const buttonPatterns = [
    'inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors',
    'inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors',
  ];
  const badgePatterns = [
    'inline-flex items-center px-2 py-0.5 text-xs font-medium text-green-800 bg-green-100 rounded-full',
    'inline-flex items-center px-2 py-0.5 text-xs font-medium text-red-800 bg-red-100 rounded-full',
    'inline-flex items-center px-2 py-0.5 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full',
    'inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-800 bg-blue-100 rounded-full',
  ];

  const headers = ['ID', 'Name', 'Email', 'Status', 'Role', 'Department', 'Location', 'Phone', 'Start Date', 'Salary',
                   'Manager', 'Team', 'Projects', 'Skills', 'Rating', 'Level', 'Type', 'Active', 'Notes', 'Actions'];
  const headerRow = headers.map(h => `<th class="${headerPattern}">${h}</th>`).join('\n        ');

  let tableRows = [];
  for (let row = 0; row < rows; row++) {
    let cells = [];
    for (let col = 0; col < COLS; col++) {
      const cellClass = cellPatterns[col % cellPatterns.length];
      if (col === 0) {
        cells.push(`<td class="${cellClass}">${row + 1}</td>`);
      } else if (col === 3) {
        const badge = badgePatterns[row % badgePatterns.length];
        const statuses = ['Active', 'Inactive', 'Pending', 'Review'];
        cells.push(`<td class="${cellClass}"><span class="${badge}">${statuses[row % 4]}</span></td>`);
      } else if (col === 19) {
        cells.push(`<td class="${cellClass}">
      <button class="${buttonPatterns[0]}">Edit</button>
      <button class="${buttonPatterns[1]}">Delete</button>
    </td>`);
      } else {
        cells.push(`<td class="${cellClass}">Data ${row}-${col}</td>`);
      }
    }
    const rowClass = row % 2 === 0 ? '' : 'bg-gray-50';
    tableRows.push(`    <tr class="${rowClass}">
      ${cells.join('\n      ')}
    </tr>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Benchmark Table - ${rows} rows × ${COLS} columns</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="bg-gray-100 min-h-screen p-8">
  <div class="max-w-full mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 mb-6">Benchmark Table</h1>
    <p class="text-gray-600 mb-4">${rows} rows × ${COLS} columns = ${rows * COLS} cells</p>
    <div class="bg-white rounded-lg shadow-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              ${headerRow}
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
${tableRows.join('\n')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function startServer() {
  const { spawn } = require('child_process');
  return new Promise((resolve) => {
    server = spawn('npx', ['serve', 'dist', '-p', PORT.toString(), '-s'], {
      cwd: __dirname,
      stdio: 'pipe',
    });
    setTimeout(() => resolve(server), 2000);
  });
}

async function getMetrics(client) {
  const { metrics } = await client.send('Performance.getMetrics');
  const metricsMap = {};
  for (const m of metrics) {
    metricsMap[m.name] = m.value;
  }
  return metricsMap;
}

async function measurePerformance(page, client) {
  await client.send('Network.clearBrowserCache');

  const startTime = Date.now();
  await page.goto(URL, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - startTime;

  const metrics = await getMetrics(client);

  const paintTiming = await page.evaluate(() => {
    const entries = performance.getEntriesByType('paint');
    const fcp = entries.find(e => e.name === 'first-contentful-paint');
    return { firstContentfulPaint: fcp ? fcp.startTime : 0 };
  });

  const htmlSize = fs.statSync(path.join(__dirname, 'dist/index.html')).size;
  const cssSize = fs.statSync(path.join(__dirname, 'dist/styles.css')).size;

  return {
    loadTime,
    styleRecalc: (metrics.RecalcStyleDuration || 0) * 1000,
    layoutDuration: (metrics.LayoutDuration || 0) * 1000,
    firstContentfulPaint: paintTiming.firstContentfulPaint,
    htmlSize: htmlSize / 1024,
    cssSize: cssSize / 1024,
  };
}

async function runTest(rows, isOptimized) {
  // Generate HTML
  const html = generateTable(rows);
  fs.writeFileSync(path.join(__dirname, 'dist/index.html'), html);

  // Compile Tailwind CSS
  execSync('npx @tailwindcss/cli -i input.css -o dist/styles.css --content "dist/**/*.html" 2>/dev/null', {
    cwd: __dirname,
    stdio: 'pipe'
  });

  // Run classpresso if optimized
  if (isOptimized) {
    execSync('npx classpresso optimize --dir dist --purge-unused 2>/dev/null', {
      cwd: __dirname,
      stdio: 'pipe'
    });
  }

  // Measure performance
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

  const results = [];
  for (let i = 0; i < RUNS_PER_TEST; i++) {
    const result = await measurePerformance(page, client);
    results.push(result);
    await sleep(300);
  }

  await browser.close();

  // Average results
  return {
    loadTime: results.reduce((a, b) => a + b.loadTime, 0) / RUNS_PER_TEST,
    styleRecalc: results.reduce((a, b) => a + b.styleRecalc, 0) / RUNS_PER_TEST,
    layoutDuration: results.reduce((a, b) => a + b.layoutDuration, 0) / RUNS_PER_TEST,
    firstContentfulPaint: results.reduce((a, b) => a + b.firstContentfulPaint, 0) / RUNS_PER_TEST,
    htmlSize: results[0].htmlSize,
    cssSize: results[0].cssSize,
  };
}

function printResults(allResults) {
  console.log('\n' + '='.repeat(100));
  console.log('CLASSPRESSO BENCHMARK SUITE - 10 TABLE SIZES');
  console.log('='.repeat(100));
  console.log(`Columns: ${COLS} | Runs per test: ${RUNS_PER_TEST} | CPU Throttle: ${CPU_THROTTLE}x`);
  console.log('='.repeat(100));

  // HTML Size comparison
  console.log('\n📦 HTML SIZE (KB)');
  console.log('-'.repeat(100));
  console.log(padRight('Rows', 8) + padRight('Baseline', 15) + padRight('Optimized', 15) + padRight('Saved', 15) + padRight('Reduction %', 15));
  console.log('-'.repeat(100));
  for (const r of allResults) {
    const saved = r.baseline.htmlSize - r.optimized.htmlSize;
    const pct = (saved / r.baseline.htmlSize * 100).toFixed(1);
    console.log(
      padRight(r.rows.toString(), 8) +
      padRight(r.baseline.htmlSize.toFixed(1), 15) +
      padRight(r.optimized.htmlSize.toFixed(1), 15) +
      padRight(saved.toFixed(1), 15) +
      padRight(`${pct}%`, 15)
    );
  }

  // CSS Size comparison
  console.log('\n🎨 CSS SIZE (KB)');
  console.log('-'.repeat(100));
  console.log(padRight('Rows', 8) + padRight('Baseline', 15) + padRight('Optimized', 15) + padRight('Change', 15));
  console.log('-'.repeat(100));
  for (const r of allResults) {
    const change = r.optimized.cssSize - r.baseline.cssSize;
    console.log(
      padRight(r.rows.toString(), 8) +
      padRight(r.baseline.cssSize.toFixed(1), 15) +
      padRight(r.optimized.cssSize.toFixed(1), 15) +
      padRight(`+${change.toFixed(1)}`, 15)
    );
  }

  // Total Size comparison
  console.log('\n📊 TOTAL SIZE (HTML + CSS) (KB)');
  console.log('-'.repeat(100));
  console.log(padRight('Rows', 8) + padRight('Baseline', 15) + padRight('Optimized', 15) + padRight('Saved', 15) + padRight('Reduction %', 15));
  console.log('-'.repeat(100));
  for (const r of allResults) {
    const baseTotal = r.baseline.htmlSize + r.baseline.cssSize;
    const optTotal = r.optimized.htmlSize + r.optimized.cssSize;
    const saved = baseTotal - optTotal;
    const pct = (saved / baseTotal * 100).toFixed(1);
    console.log(
      padRight(r.rows.toString(), 8) +
      padRight(baseTotal.toFixed(1), 15) +
      padRight(optTotal.toFixed(1), 15) +
      padRight(saved.toFixed(1), 15) +
      padRight(`${pct}%`, 15)
    );
  }

  // First Contentful Paint
  console.log('\n⚡ FIRST CONTENTFUL PAINT (ms)');
  console.log('-'.repeat(100));
  console.log(padRight('Rows', 8) + padRight('Baseline', 15) + padRight('Optimized', 15) + padRight('Faster by', 15) + padRight('Improvement %', 15));
  console.log('-'.repeat(100));
  for (const r of allResults) {
    const faster = r.baseline.firstContentfulPaint - r.optimized.firstContentfulPaint;
    const pct = (faster / r.baseline.firstContentfulPaint * 100).toFixed(1);
    console.log(
      padRight(r.rows.toString(), 8) +
      padRight(r.baseline.firstContentfulPaint.toFixed(1), 15) +
      padRight(r.optimized.firstContentfulPaint.toFixed(1), 15) +
      padRight(faster.toFixed(1), 15) +
      padRight(`${pct}%`, 15)
    );
  }

  // Page Load Time
  console.log('\n🚀 PAGE LOAD TIME (ms)');
  console.log('-'.repeat(100));
  console.log(padRight('Rows', 8) + padRight('Baseline', 15) + padRight('Optimized', 15) + padRight('Faster by', 15) + padRight('Improvement %', 15));
  console.log('-'.repeat(100));
  for (const r of allResults) {
    const faster = r.baseline.loadTime - r.optimized.loadTime;
    const pct = (faster / r.baseline.loadTime * 100).toFixed(1);
    console.log(
      padRight(r.rows.toString(), 8) +
      padRight(r.baseline.loadTime.toFixed(0), 15) +
      padRight(r.optimized.loadTime.toFixed(0), 15) +
      padRight(faster.toFixed(0), 15) +
      padRight(`${pct}%`, 15)
    );
  }

  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));

  const avgHtmlReduction = allResults.reduce((a, r) => {
    return a + ((r.baseline.htmlSize - r.optimized.htmlSize) / r.baseline.htmlSize * 100);
  }, 0) / allResults.length;

  const avgFCPImprovement = allResults.reduce((a, r) => {
    return a + ((r.baseline.firstContentfulPaint - r.optimized.firstContentfulPaint) / r.baseline.firstContentfulPaint * 100);
  }, 0) / allResults.length;

  console.log(`Average HTML size reduction: ${avgHtmlReduction.toFixed(1)}%`);
  console.log(`Average FCP improvement: ${avgFCPImprovement.toFixed(1)}%`);
  console.log('\n');
}

function padRight(str, len) {
  return (str + ' '.repeat(len)).slice(0, len);
}

async function main() {
  console.log('Classpresso Benchmark Suite');
  console.log('Testing 10 table sizes: 100-1000 rows');
  console.log('='.repeat(50));

  // Start server
  console.log('\nStarting server...');
  await startServer();
  await sleep(2000);

  const allResults = [];

  for (const rows of ROW_CONFIGS) {
    console.log(`\n[${rows} rows] Testing...`);

    // Baseline test
    process.stdout.write(`  Baseline: `);
    const baseline = await runTest(rows, false);
    console.log(`${baseline.htmlSize.toFixed(1)} KB, FCP: ${baseline.firstContentfulPaint.toFixed(0)}ms`);

    // Optimized test
    process.stdout.write(`  Optimized: `);
    const optimized = await runTest(rows, true);
    console.log(`${optimized.htmlSize.toFixed(1)} KB, FCP: ${optimized.firstContentfulPaint.toFixed(0)}ms`);

    allResults.push({ rows, baseline, optimized });
  }

  // Kill server
  if (server) server.kill();

  // Print results
  printResults(allResults);

  // Save results to JSON
  const resultsFile = path.join(__dirname, 'benchmark-suite-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: { cols: COLS, runsPerTest: RUNS_PER_TEST, cpuThrottle: CPU_THROTTLE },
    results: allResults,
  }, null, 2));
  console.log(`Results saved to: ${resultsFile}`);
}

main().catch(console.error);
