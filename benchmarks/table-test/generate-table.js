/**
 * Generate a large HTML table with Tailwind classes for benchmarking
 * 100 rows × 20 columns = 2000 cells
 */

const fs = require('fs');

const ROWS = 100;
const COLS = 20;

// Common Tailwind class patterns that will be repeated
const cellPatterns = [
  'px-4 py-2 text-sm text-gray-700 bg-white border-b border-gray-200',
  'px-4 py-2 text-sm text-gray-900 bg-gray-50 border-b border-gray-200',
  'px-4 py-2 text-sm font-medium text-gray-700 bg-white border-b border-gray-200',
  'px-4 py-2 text-sm text-blue-600 bg-white border-b border-gray-200 hover:text-blue-800',
];

const headerPattern = 'px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100 border-b border-gray-300';

const buttonPatterns = [
  'inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors',
  'inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors',
  'inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors',
  'inline-flex items-center justify-center px-3 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors',
];

const badgePatterns = [
  'inline-flex items-center px-2 py-0.5 text-xs font-medium text-green-800 bg-green-100 rounded-full',
  'inline-flex items-center px-2 py-0.5 text-xs font-medium text-red-800 bg-red-100 rounded-full',
  'inline-flex items-center px-2 py-0.5 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full',
  'inline-flex items-center px-2 py-0.5 text-xs font-medium text-blue-800 bg-blue-100 rounded-full',
];

function generateHeaders() {
  const headers = ['ID', 'Name', 'Email', 'Status', 'Role', 'Department', 'Location', 'Phone', 'Start Date', 'Salary',
                   'Manager', 'Team', 'Projects', 'Skills', 'Rating', 'Level', 'Type', 'Active', 'Notes', 'Actions'];
  return headers.map(h => `<th class="${headerPattern}">${h}</th>`).join('\n        ');
}

function generateCell(row, col) {
  const cellClass = cellPatterns[col % cellPatterns.length];

  // Different content types for variety
  if (col === 0) {
    return `<td class="${cellClass}">${row + 1}</td>`;
  } else if (col === 3) {
    // Status badge
    const badge = badgePatterns[row % badgePatterns.length];
    const statuses = ['Active', 'Inactive', 'Pending', 'Review'];
    return `<td class="${cellClass}"><span class="${badge}">${statuses[row % 4]}</span></td>`;
  } else if (col === 19) {
    // Action buttons
    const btn1 = buttonPatterns[0];
    const btn2 = buttonPatterns[3];
    return `<td class="${cellClass}">
      <button class="${btn1}">Edit</button>
      <button class="${btn2}">Delete</button>
    </td>`;
  } else {
    return `<td class="${cellClass}">Data ${row}-${col}</td>`;
  }
}

function generateRow(row) {
  const cells = [];
  for (let col = 0; col < COLS; col++) {
    cells.push(generateCell(row, col));
  }
  const rowClass = row % 2 === 0 ? '' : 'bg-gray-50';
  return `    <tr class="${rowClass}">
      ${cells.join('\n      ')}
    </tr>`;
}

function generateHTML() {
  const rows = [];
  for (let row = 0; row < ROWS; row++) {
    rows.push(generateRow(row));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Benchmark Table - ${ROWS} rows × ${COLS} columns</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="bg-gray-100 min-h-screen p-8">
  <div class="max-w-full mx-auto">
    <h1 class="text-3xl font-bold text-gray-900 mb-6">Benchmark Table</h1>
    <p class="text-gray-600 mb-4">${ROWS} rows × ${COLS} columns = ${ROWS * COLS} cells</p>

    <div class="bg-white rounded-lg shadow-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              ${generateHeaders()}
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
${rows.join('\n')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="mt-6 flex items-center justify-between">
      <p class="text-sm text-gray-600">Showing ${ROWS} entries</p>
      <div class="flex gap-2">
        <button class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Previous</button>
        <button class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">Next</button>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Generate the HTML
const html = generateHTML();
fs.writeFileSync('dist/index.html', html);
console.log(`Generated table: ${ROWS} rows × ${COLS} columns = ${ROWS * COLS} cells`);
console.log(`File size: ${(Buffer.byteLength(html, 'utf-8') / 1024).toFixed(2)} KB`);
