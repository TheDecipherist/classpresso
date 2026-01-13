/**
 * Classpresso Full Website Benchmark
 * Tests a complete website with nav, hero, features, cards, testimonials, pricing, FAQ, CTA, footer
 */

const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3458;
const URL = `http://localhost:${PORT}`;
const RUNS_PER_TEST = 5;
const CPU_THROTTLE = 4;

let server = null;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer() {
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
    const fp = entries.find(e => e.name === 'first-paint');
    const fcp = entries.find(e => e.name === 'first-contentful-paint');
    return {
      firstPaint: fp ? fp.startTime : 0,
      firstContentfulPaint: fcp ? fcp.startTime : 0,
    };
  });

  const htmlSize = fs.statSync(path.join(__dirname, 'dist/index.html')).size;
  const cssSize = fs.statSync(path.join(__dirname, 'dist/styles.css')).size;

  return {
    loadTime,
    styleRecalc: (metrics.RecalcStyleDuration || 0) * 1000,
    layoutDuration: (metrics.LayoutDuration || 0) * 1000,
    taskDuration: (metrics.TaskDuration || 0) * 1000,
    firstPaint: paintTiming.firstPaint,
    firstContentfulPaint: paintTiming.firstContentfulPaint,
    jsHeapUsed: (metrics.JSHeapUsedSize || 0) / 1024 / 1024,
    htmlSize: htmlSize / 1024,
    cssSize: cssSize / 1024,
  };
}

async function runBenchmark(label) {
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
    process.stdout.write('.');
    await sleep(500);
  }
  console.log();

  await browser.close();

  const avg = {};
  for (const key of Object.keys(results[0])) {
    avg[key] = results.reduce((a, b) => a + b[key], 0) / RUNS_PER_TEST;
  }
  return avg;
}

function padRight(str, len) {
  return (str + ' '.repeat(len)).slice(0, len);
}

function printResults(baseline, optimized) {
  console.log('\n' + '='.repeat(85));
  console.log('CLASSPRESSO FULL WEBSITE BENCHMARK');
  console.log('='.repeat(85));
  console.log('Sections: Nav, Hero, Stats, Features, Products, Testimonials, Pricing, FAQ, CTA, Footer');
  console.log(`Runs per test: ${RUNS_PER_TEST} | CPU Throttle: ${CPU_THROTTLE}x`);
  console.log('='.repeat(85));

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

  console.log('\n' + padRight('Metric', 25) + padRight('Baseline', 15) + padRight('Optimized', 15) + padRight('Change', 15));
  console.log('-'.repeat(85));

  for (const metric of metrics) {
    const baseVal = baseline[metric.key];
    const optVal = optimized[metric.key];
    const diff = baseVal - optVal;
    const pct = (diff / baseVal * 100).toFixed(1);
    const change = diff > 0 ? `↓ ${Math.abs(pct)}%` : diff < 0 ? `↑ ${Math.abs(pct)}%` : '—';

    console.log(
      padRight(metric.name, 25) +
      padRight(`${baseVal.toFixed(metric.decimals)} ${metric.unit}`, 15) +
      padRight(`${optVal.toFixed(metric.decimals)} ${metric.unit}`, 15) +
      padRight(change, 15)
    );
  }

  console.log('\n' + '='.repeat(85));
  console.log('SUMMARY');
  console.log('='.repeat(85));

  const htmlSaved = baseline.htmlSize - optimized.htmlSize;
  const htmlPct = (htmlSaved / baseline.htmlSize * 100).toFixed(1);
  console.log(`HTML size reduced: ${htmlSaved.toFixed(2)} KB (${htmlPct}%)`);

  const totalBaseline = baseline.htmlSize + baseline.cssSize;
  const totalOptimized = optimized.htmlSize + optimized.cssSize;
  const totalSaved = totalBaseline - totalOptimized;
  const totalPct = (totalSaved / totalBaseline * 100).toFixed(1);
  console.log(`Total size reduced: ${totalSaved.toFixed(2)} KB (${totalPct}%)`);

  const loadDiff = baseline.loadTime - optimized.loadTime;
  const loadPct = (loadDiff / baseline.loadTime * 100).toFixed(1);
  console.log(`Page load time: ${loadDiff > 0 ? 'improved' : 'changed'} by ${loadPct}%`);

  console.log('\n');
}

async function main() {
  console.log('Classpresso Full Website Benchmark');
  console.log('Complete website with all standard sections');
  console.log('='.repeat(50));

  // Generate fresh page
  console.log('\n[1/5] Generating website...');
  execSync('node generate-website.js', { cwd: __dirname, stdio: 'inherit' });

  // Compile Tailwind CSS
  console.log('\n[2/5] Compiling Tailwind CSS...');
  execSync('npx @tailwindcss/cli -i input.css -o dist/styles.css --content "dist/**/*.html"', { cwd: __dirname, stdio: 'inherit' });
  console.log(`CSS compiled: ${(fs.statSync(path.join(__dirname, 'dist/styles.css')).size / 1024).toFixed(2)} KB`);

  // Start server
  console.log('\n[3/5] Starting server...');
  await startServer();
  await sleep(2000);

  // Baseline benchmark
  console.log('\n[4/5] Running BASELINE benchmark...');
  process.stdout.write('  Progress: ');
  const baseline = await runBenchmark('Baseline');
  console.log(`  HTML: ${baseline.htmlSize.toFixed(2)} KB, Load: ${baseline.loadTime.toFixed(0)}ms`);

  // Run classpresso
  console.log('\n[5/5] Running classpresso optimize --purge-unused...');
  execSync('npx classpresso optimize --dir dist --purge-unused', { cwd: __dirname, stdio: 'inherit' });

  // Optimized benchmark
  console.log('\n[6/6] Running OPTIMIZED benchmark...');
  process.stdout.write('  Progress: ');
  const optimized = await runBenchmark('Optimized');
  console.log(`  HTML: ${optimized.htmlSize.toFixed(2)} KB, Load: ${optimized.loadTime.toFixed(0)}ms`);

  // Stop server
  if (server) server.kill();

  // Print results
  printResults(baseline, optimized);

  // Save results
  const resultsFile = path.join(__dirname, 'benchmark-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: { runsPerTest: RUNS_PER_TEST, cpuThrottle: CPU_THROTTLE },
    sections: ['nav', 'hero', 'stats', 'features', 'products', 'testimonials', 'pricing', 'faq', 'cta', 'footer'],
    baseline,
    optimized,
  }, null, 2));
  console.log(`Results saved to: ${resultsFile}`);
}

main().catch(console.error);
