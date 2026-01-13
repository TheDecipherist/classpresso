/**
 * Classpresso Benchmark Script
 *
 * Compares performance metrics:
 * 1. Baseline (original Tailwind classes)
 * 2. With classpresso --purge-unused optimization
 *
 * Uses Chrome DevTools Protocol for accurate metrics
 */

const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const URL = `http://localhost:${PORT}`;
const RUNS_PER_TEST = 5; // Run multiple times for accuracy
const CPU_THROTTLE = 4; // 4x slowdown to simulate mobile

// Store results
const results = {
  baseline: [],
  optimized: [],
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getMetrics(client) {
  const { metrics } = await client.send('Performance.getMetrics');
  const metricsMap = {};
  for (const m of metrics) {
    metricsMap[m.name] = m.value;
  }
  return metricsMap;
}

async function measurePerformance(page, client, label) {
  // Clear cache
  await client.send('Network.clearBrowserCache');

  // Navigate and wait for full load
  const startTime = Date.now();
  await page.goto(URL, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - startTime;

  // Get Chrome DevTools metrics
  const metrics = await getMetrics(client);

  // Get memory info
  const jsHeapUsed = metrics.JSHeapUsedSize || 0;
  const jsHeapTotal = metrics.JSHeapTotalSize || 0;

  // Get timing metrics
  const styleRecalc = metrics.RecalcStyleDuration || 0;
  const layoutDuration = metrics.LayoutDuration || 0;
  const taskDuration = metrics.TaskDuration || 0;

  // Use Performance API for paint timings
  const paintTiming = await page.evaluate(() => {
    const entries = performance.getEntriesByType('paint');
    const fp = entries.find(e => e.name === 'first-paint');
    const fcp = entries.find(e => e.name === 'first-contentful-paint');
    return {
      firstPaint: fp ? fp.startTime : 0,
      firstContentfulPaint: fcp ? fcp.startTime : 0,
    };
  });

  // Get file sizes
  const htmlSize = fs.statSync(path.join(__dirname, 'dist/index.html')).size;
  const cssSize = fs.statSync(path.join(__dirname, 'dist/styles.css')).size;

  return {
    label,
    loadTime,
    styleRecalc: styleRecalc * 1000, // Convert to ms
    layoutDuration: layoutDuration * 1000,
    taskDuration: taskDuration * 1000,
    firstPaint: paintTiming.firstPaint,
    firstContentfulPaint: paintTiming.firstContentfulPaint,
    jsHeapUsed: jsHeapUsed / 1024 / 1024, // MB
    jsHeapTotal: jsHeapTotal / 1024 / 1024,
    htmlSize: htmlSize / 1024, // KB
    cssSize: cssSize / 1024, // KB
  };
}

async function takeScreenshot(page, filename) {
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot saved: ${filename}`);
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('npx', ['serve', 'dist', '-p', PORT.toString(), '-s'], {
      cwd: __dirname,
      stdio: 'pipe',
    });

    server.stdout.on('data', (data) => {
      if (data.toString().includes('Accepting connections')) {
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Accepting connections')) {
        resolve(server);
      }
    });

    // Give it some time to start
    setTimeout(() => resolve(server), 2000);
  });
}

async function runBenchmark(label, takeShot = false) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set up CDP session for performance metrics
  const client = await context.newCDPSession(page);
  await client.send('Performance.enable');

  // Throttle CPU to simulate mobile
  await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

  const runResults = [];

  for (let i = 0; i < RUNS_PER_TEST; i++) {
    const result = await measurePerformance(page, client, label);
    runResults.push(result);
    console.log(`  Run ${i + 1}/${RUNS_PER_TEST}: Load=${result.loadTime}ms, StyleRecalc=${result.styleRecalc.toFixed(2)}ms`);
    await sleep(500); // Wait between runs
  }

  // Take screenshot on first run
  if (takeShot) {
    await page.goto(URL, { waitUntil: 'networkidle' });
    await takeScreenshot(page, path.join(__dirname, `screenshot-${label.toLowerCase().replace(/\s+/g, '-')}.png`));
  }

  await browser.close();

  // Calculate averages
  const avg = {
    label,
    loadTime: runResults.reduce((a, b) => a + b.loadTime, 0) / RUNS_PER_TEST,
    styleRecalc: runResults.reduce((a, b) => a + b.styleRecalc, 0) / RUNS_PER_TEST,
    layoutDuration: runResults.reduce((a, b) => a + b.layoutDuration, 0) / RUNS_PER_TEST,
    taskDuration: runResults.reduce((a, b) => a + b.taskDuration, 0) / RUNS_PER_TEST,
    firstPaint: runResults.reduce((a, b) => a + b.firstPaint, 0) / RUNS_PER_TEST,
    firstContentfulPaint: runResults.reduce((a, b) => a + b.firstContentfulPaint, 0) / RUNS_PER_TEST,
    jsHeapUsed: runResults.reduce((a, b) => a + b.jsHeapUsed, 0) / RUNS_PER_TEST,
    jsHeapTotal: runResults.reduce((a, b) => a + b.jsHeapTotal, 0) / RUNS_PER_TEST,
    htmlSize: runResults[0].htmlSize, // Same for all runs
    cssSize: runResults[0].cssSize, // Same for all runs
  };

  return avg;
}

function printComparison(baseline, optimized) {
  console.log('\n' + '='.repeat(70));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(70));
  console.log(`Test: 100 rows × 20 columns = 2000 cells with Tailwind classes`);
  console.log(`CPU Throttle: ${CPU_THROTTLE}x (simulating mobile device)`);
  console.log(`Runs per test: ${RUNS_PER_TEST}`);
  console.log('='.repeat(70));

  const metrics = [
    { name: 'HTML Size', unit: 'KB', key: 'htmlSize', decimals: 2 },
    { name: 'CSS Size', unit: 'KB', key: 'cssSize', decimals: 2 },
    { name: 'Page Load Time', unit: 'ms', key: 'loadTime', decimals: 0 },
    { name: 'First Paint', unit: 'ms', key: 'firstPaint', decimals: 2 },
    { name: 'First Contentful Paint', unit: 'ms', key: 'firstContentfulPaint', decimals: 2 },
    { name: 'Style Recalculation', unit: 'ms', key: 'styleRecalc', decimals: 2 },
    { name: 'Layout Duration', unit: 'ms', key: 'layoutDuration', decimals: 2 },
    { name: 'Total Task Duration', unit: 'ms', key: 'taskDuration', decimals: 2 },
    { name: 'JS Heap Used', unit: 'MB', key: 'jsHeapUsed', decimals: 2 },
  ];

  console.log('\n');
  console.log(padRight('Metric', 25) + padRight('Baseline', 15) + padRight('Optimized', 15) + padRight('Improvement', 15));
  console.log('-'.repeat(70));

  for (const metric of metrics) {
    const baseVal = baseline[metric.key];
    const optVal = optimized[metric.key];
    const diff = baseVal - optVal;
    const pctImprovement = (diff / baseVal * 100).toFixed(1);
    const improvement = diff > 0 ? `↓ ${pctImprovement}%` : diff < 0 ? `↑ ${Math.abs(pctImprovement)}%` : '—';

    console.log(
      padRight(metric.name, 25) +
      padRight(`${baseVal.toFixed(metric.decimals)} ${metric.unit}`, 15) +
      padRight(`${optVal.toFixed(metric.decimals)} ${metric.unit}`, 15) +
      padRight(improvement, 15)
    );
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const htmlSaved = baseline.htmlSize - optimized.htmlSize;
  const htmlPct = (htmlSaved / baseline.htmlSize * 100).toFixed(1);
  console.log(`HTML size reduced by ${htmlSaved.toFixed(2)} KB (${htmlPct}%)`);

  const cssSaved = baseline.cssSize - optimized.cssSize;
  const cssPct = (cssSaved / baseline.cssSize * 100).toFixed(1);
  console.log(`CSS size ${cssSaved > 0 ? 'reduced' : 'increased'} by ${Math.abs(cssSaved).toFixed(2)} KB (${Math.abs(cssPct)}%)`);

  const totalSaved = htmlSaved + cssSaved;
  const totalBaseline = baseline.htmlSize + baseline.cssSize;
  const totalPct = (totalSaved / totalBaseline * 100).toFixed(1);
  console.log(`Total size reduced by ${totalSaved.toFixed(2)} KB (${totalPct}%)`);

  const styleImprovement = ((baseline.styleRecalc - optimized.styleRecalc) / baseline.styleRecalc * 100).toFixed(1);
  console.log(`Style recalculation improved by ${styleImprovement}%`);

  const fcpImprovement = ((baseline.firstContentfulPaint - optimized.firstContentfulPaint) / baseline.firstContentfulPaint * 100).toFixed(1);
  console.log(`First Contentful Paint improved by ${fcpImprovement}%`);

  console.log('\n');
}

function padRight(str, len) {
  return (str + ' '.repeat(len)).slice(0, len);
}

async function main() {
  console.log('Classpresso Benchmark - 100×20 Tailwind Table');
  console.log('='.repeat(50));

  // Step 1: Generate fresh table and compile CSS
  console.log('\n[1/6] Generating fresh table and compiling Tailwind CSS...');
  execSync('node generate-table.js', { cwd: __dirname, stdio: 'inherit' });
  execSync('npx @tailwindcss/cli -i input.css -o dist/styles.css --content "dist/**/*.html"', { cwd: __dirname, stdio: 'inherit' });
  console.log(`CSS compiled: ${(fs.statSync(path.join(__dirname, 'dist/styles.css')).size / 1024).toFixed(2)} KB`);

  // Step 2: Start server
  console.log('\n[2/6] Starting server...');
  const server = await startServer();
  await sleep(1000);

  // Step 3: Run baseline benchmark
  console.log('\n[3/6] Running BASELINE benchmark (original Tailwind classes)...');
  const baselineResults = await runBenchmark('Baseline', true);
  console.log(`  Average load time: ${baselineResults.loadTime.toFixed(0)}ms`);

  // Step 4: Run classpresso optimization with --purge-unused
  console.log('\n[4/6] Running classpresso optimize --purge-unused...');
  try {
    execSync('npx classpresso optimize --dir dist --purge-unused', {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (e) {
    console.error('Classpresso optimization failed:', e.message);
  }

  // Step 5: Run optimized benchmark
  console.log('\n[5/6] Running OPTIMIZED benchmark (with classpresso + purge)...');
  const optimizedResults = await runBenchmark('Optimized', true);
  console.log(`  Average load time: ${optimizedResults.loadTime.toFixed(0)}ms`);

  // Step 6: Compare and display results
  console.log('\n[6/6] Comparing results...');
  printComparison(baselineResults, optimizedResults);

  // Stop server
  server.kill();

  // Save results to JSON
  const resultsFile = path.join(__dirname, 'benchmark-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: {
      runs: RUNS_PER_TEST,
      cpuThrottle: CPU_THROTTLE,
      tableSize: '100×20',
      cellCount: 2000,
    },
    baseline: baselineResults,
    optimized: optimizedResults,
  }, null, 2));
  console.log(`Results saved to: ${resultsFile}`);
}

main().catch(console.error);
