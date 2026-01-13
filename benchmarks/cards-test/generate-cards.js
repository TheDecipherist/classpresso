/**
 * Generate a realistic dashboard with 100 varied cards
 * Each card has different elements to simulate real-world usage
 */

const fs = require('fs');

// Card type generators - each creates a different style of card
const cardTypes = [
  // 1. User Profile Card
  () => `
    <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div class="flex items-center space-x-4">
        <div class="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <span class="text-white font-bold text-lg">${randomInitials()}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-lg font-semibold text-gray-900 truncate">${randomName()}</p>
          <p class="text-sm text-gray-500 truncate">${randomEmail()}</p>
        </div>
      </div>
      <div class="mt-4 flex space-x-2">
        <button class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Message</button>
        <button class="inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">Follow</button>
      </div>
    </div>`,

  // 2. Stats Card
  () => `
    <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-500 uppercase tracking-wide">Total ${randomMetric()}</p>
          <p class="mt-2 text-3xl font-bold text-gray-900">${randomNumber(1000, 50000).toLocaleString()}</p>
        </div>
        <div class="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <span class="text-green-600 text-xl">↑</span>
        </div>
      </div>
      <div class="mt-4">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">+${randomNumber(5, 25)}%</span>
        <span class="ml-2 text-sm text-gray-500">vs last month</span>
      </div>
    </div>`,

  // 3. Task Card
  () => `
    <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${randomPriorityClass()}">${randomPriority()}</span>
          <h3 class="mt-2 text-lg font-semibold text-gray-900">${randomTask()}</h3>
          <p class="mt-1 text-sm text-gray-500">Due ${randomDate()}</p>
        </div>
      </div>
      <div class="mt-4 flex items-center justify-between">
        <div class="flex -space-x-2">
          ${[1,2,3].map(() => `<div class="w-8 h-8 bg-gray-300 rounded-full border-2 border-white"></div>`).join('')}
        </div>
        <button class="inline-flex items-center justify-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors">View</button>
      </div>
    </div>`,

  // 4. Product Card
  () => `
    <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div class="h-40 bg-gradient-to-br ${randomGradient()} flex items-center justify-center">
        <span class="text-white text-4xl">📦</span>
      </div>
      <div class="p-6">
        <h3 class="text-lg font-semibold text-gray-900">${randomProduct()}</h3>
        <p class="mt-1 text-sm text-gray-500 line-clamp-2">Premium quality product with fast shipping and excellent customer support.</p>
        <div class="mt-4 flex items-center justify-between">
          <span class="text-2xl font-bold text-gray-900">$${randomNumber(29, 299)}</span>
          <button class="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">Add to Cart</button>
        </div>
      </div>
    </div>`,

  // 5. Notification Card
  () => `
    <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border-l-4 ${randomBorderColor()}">
      <div class="flex items-start space-x-4">
        <div class="flex-shrink-0 w-10 h-10 ${randomBgColor()} rounded-full flex items-center justify-center">
          <span class="text-lg">${randomEmoji()}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900">${randomNotification()}</p>
          <p class="mt-1 text-xs text-gray-500">${randomTimeAgo()}</p>
        </div>
        <button class="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
          <span class="text-xl">×</span>
        </button>
      </div>
    </div>`,

  // 6. Progress Card
  () => {
    const progress = randomNumber(20, 95);
    return `
    <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">${randomProject()}</h3>
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">${progress}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2.5">
        <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${progress}%"></div>
      </div>
      <div class="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>${randomNumber(5, 20)} tasks completed</span>
        <span>${randomNumber(1, 10)} remaining</span>
      </div>
    </div>`;
  },

  // 7. Review Card
  () => `
    <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div class="flex items-center space-x-1 mb-3">
        ${[1,2,3,4,5].map(i => `<span class="text-yellow-400 text-lg">${i <= randomNumber(3,5) ? '★' : '☆'}</span>`).join('')}
      </div>
      <p class="text-gray-700 text-sm italic">"${randomReview()}"</p>
      <div class="mt-4 flex items-center space-x-3">
        <div class="w-10 h-10 bg-gray-300 rounded-full"></div>
        <div>
          <p class="text-sm font-medium text-gray-900">${randomName()}</p>
          <p class="text-xs text-gray-500">Verified Buyer</p>
        </div>
      </div>
    </div>`,

  // 8. Event Card
  () => `
    <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
        <p class="text-white text-sm font-medium opacity-90">${randomMonth()} ${randomNumber(1, 28)}</p>
        <h3 class="text-white text-xl font-bold mt-1">${randomEvent()}</h3>
      </div>
      <div class="p-6">
        <div class="flex items-center text-sm text-gray-500 mb-3">
          <span class="mr-2">📍</span>
          <span>${randomLocation()}</span>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex -space-x-2">
            ${[1,2,3,4].map(() => `<div class="w-8 h-8 bg-gray-300 rounded-full border-2 border-white"></div>`).join('')}
            <div class="w-8 h-8 bg-gray-100 rounded-full border-2 border-white flex items-center justify-center text-xs text-gray-600">+${randomNumber(10, 99)}</div>
          </div>
          <button class="inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors">RSVP</button>
        </div>
      </div>
    </div>`,

  // 9. Pricing Card
  () => `
    <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow ${randomNumber(0,1) ? 'ring-2 ring-blue-500' : ''}">
      <h3 class="text-lg font-semibold text-gray-900">${randomPlan()}</h3>
      <p class="mt-2 text-sm text-gray-500">Perfect for ${randomAudience()}</p>
      <div class="mt-4">
        <span class="text-4xl font-bold text-gray-900">$${randomNumber(9, 99)}</span>
        <span class="text-gray-500">/mo</span>
      </div>
      <ul class="mt-6 space-y-3">
        ${[1,2,3,4].map(() => `<li class="flex items-center text-sm text-gray-600"><span class="text-green-500 mr-2">✓</span>${randomFeature()}</li>`).join('')}
      </ul>
      <button class="mt-6 w-full inline-flex items-center justify-center px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Get Started</button>
    </div>`,

  // 10. Weather Card
  () => `
    <div class="bg-gradient-to-br ${randomGradient()} rounded-xl shadow-md p-6 text-white">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium opacity-90">${randomCity()}</p>
          <p class="text-5xl font-bold mt-2">${randomNumber(15, 35)}°</p>
        </div>
        <div class="text-6xl">${['☀️', '⛅', '🌧️', '❄️', '🌤️'][randomNumber(0, 4)]}</div>
      </div>
      <div class="mt-6 flex justify-between text-sm">
        <div class="text-center">
          <p class="opacity-75">Wind</p>
          <p class="font-semibold">${randomNumber(5, 25)} km/h</p>
        </div>
        <div class="text-center">
          <p class="opacity-75">Humidity</p>
          <p class="font-semibold">${randomNumber(30, 80)}%</p>
        </div>
        <div class="text-center">
          <p class="opacity-75">UV</p>
          <p class="font-semibold">${randomNumber(1, 10)}</p>
        </div>
      </div>
    </div>`,
];

// Helper functions
function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomInitials() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[randomNumber(0, 25)] + letters[randomNumber(0, 25)];
}

function randomName() {
  const first = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Charlie', 'Sam'];
  const last = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Wilson'];
  return `${first[randomNumber(0, 9)]} ${last[randomNumber(0, 9)]}`;
}

function randomEmail() {
  return `user${randomNumber(100, 999)}@example.com`;
}

function randomMetric() {
  return ['Revenue', 'Users', 'Orders', 'Views', 'Sales', 'Visits'][randomNumber(0, 5)];
}

function randomPriority() {
  return ['High', 'Medium', 'Low', 'Urgent'][randomNumber(0, 3)];
}

function randomPriorityClass() {
  return ['bg-red-100 text-red-800', 'bg-yellow-100 text-yellow-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800'][randomNumber(0, 3)];
}

function randomTask() {
  return ['Review PR #' + randomNumber(100, 999), 'Update documentation', 'Fix bug in auth', 'Deploy to staging', 'Code review', 'Team standup'][randomNumber(0, 5)];
}

function randomDate() {
  return ['Today', 'Tomorrow', 'In 3 days', 'Next week', 'Jan ' + randomNumber(10, 30)][randomNumber(0, 4)];
}

function randomProduct() {
  return ['Wireless Headphones', 'Smart Watch', 'Laptop Stand', 'USB-C Hub', 'Mechanical Keyboard', 'Monitor Light'][randomNumber(0, 5)];
}

function randomGradient() {
  return ['from-blue-500 to-purple-600', 'from-green-400 to-blue-500', 'from-pink-500 to-orange-400', 'from-indigo-500 to-purple-600', 'from-teal-400 to-cyan-500'][randomNumber(0, 4)];
}

function randomBorderColor() {
  return ['border-blue-500', 'border-green-500', 'border-yellow-500', 'border-red-500', 'border-purple-500'][randomNumber(0, 4)];
}

function randomBgColor() {
  return ['bg-blue-100', 'bg-green-100', 'bg-yellow-100', 'bg-red-100', 'bg-purple-100'][randomNumber(0, 4)];
}

function randomEmoji() {
  return ['📬', '🎉', '⚠️', '✅', '💬', '🔔'][randomNumber(0, 5)];
}

function randomNotification() {
  return ['New comment on your post', 'Your order has shipped', 'Meeting in 15 minutes', 'Task completed successfully', 'New follower alert'][randomNumber(0, 4)];
}

function randomTimeAgo() {
  return ['Just now', '5 min ago', '1 hour ago', '3 hours ago', 'Yesterday'][randomNumber(0, 4)];
}

function randomProject() {
  return ['Website Redesign', 'Mobile App', 'API Integration', 'Database Migration', 'Marketing Campaign'][randomNumber(0, 4)];
}

function randomReview() {
  return [
    'Absolutely love this product! Exceeded expectations.',
    'Great quality and fast shipping. Highly recommend.',
    'Exactly what I needed. Will buy again.',
    'Amazing customer service and product quality.',
  ][randomNumber(0, 3)];
}

function randomEvent() {
  return ['Tech Conference', 'Team Building', 'Product Launch', 'Workshop', 'Networking Event'][randomNumber(0, 4)];
}

function randomMonth() {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][randomNumber(0, 5)];
}

function randomLocation() {
  return ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'Denver, CO'][randomNumber(0, 4)];
}

function randomPlan() {
  return ['Starter', 'Pro', 'Business', 'Enterprise'][randomNumber(0, 3)];
}

function randomAudience() {
  return ['individuals', 'small teams', 'growing businesses', 'large enterprises'][randomNumber(0, 3)];
}

function randomFeature() {
  return ['Unlimited projects', '24/7 support', 'API access', 'Custom integrations', 'Advanced analytics', 'Priority support'][randomNumber(0, 5)];
}

function randomCity() {
  return ['San Francisco', 'New York', 'London', 'Tokyo', 'Sydney'][randomNumber(0, 4)];
}

// Generate the page
function generatePage() {
  const cards = [];
  for (let i = 0; i < 100; i++) {
    const cardType = cardTypes[i % cardTypes.length];
    cards.push(cardType());
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - 100 Varied Cards</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="bg-gray-100 min-h-screen">
  <header class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div class="flex items-center space-x-4">
          <button class="inline-flex items-center justify-center px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">Settings</button>
          <button class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">New Item</button>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
${cards.join('\n')}
    </div>
  </main>

  <footer class="bg-white border-t border-gray-200 mt-12">
    <div class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <p class="text-center text-sm text-gray-500">100 varied cards benchmark test</p>
    </div>
  </footer>
</body>
</html>`;
}

// Create dist folder and generate
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

const html = generatePage();
fs.writeFileSync('dist/index.html', html);
console.log(`Generated dashboard: 100 varied cards (10 different types)`);
console.log(`File size: ${(Buffer.byteLength(html, 'utf-8') / 1024).toFixed(2)} KB`);
