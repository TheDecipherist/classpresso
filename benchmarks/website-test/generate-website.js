/**
 * Generate a full-fledged website with all common sections
 * - Navigation bar
 * - Hero section
 * - Features section
 * - Stats section
 * - Cards/Products section
 * - Testimonials
 * - Pricing
 * - FAQ
 * - CTA section
 * - Footer
 */

const fs = require('fs');

// Helper functions
function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomName() {
  const first = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Charlie', 'Sam'];
  const last = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Wilson'];
  return `${first[randomNumber(0, 9)]} ${last[randomNumber(0, 9)]}`;
}

// Navigation
const navigation = `
  <nav class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center space-x-8">
          <a href="#" class="flex items-center space-x-2">
            <div class="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-sm">CP</span>
            </div>
            <span class="text-xl font-bold text-gray-900">Classpresso</span>
          </a>
          <div class="hidden md:flex items-center space-x-6">
            <a href="#features" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#testimonials" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Testimonials</a>
            <a href="#faq" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">FAQ</a>
          </div>
        </div>
        <div class="flex items-center space-x-4">
          <a href="#" class="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Sign in</a>
          <a href="#" class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Get Started</a>
        </div>
      </div>
    </div>
  </nav>`;

// Hero Section
const hero = `
  <section class="bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20 lg:py-32">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 mb-6">
            🚀 New: v2.0 Released
          </span>
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
            Build faster with <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">optimized CSS</span>
          </h1>
          <p class="mt-6 text-lg text-gray-600 leading-relaxed">
            Classpresso consolidates your Tailwind classes at build time, reducing HTML size by 60% and improving browser rendering performance.
          </p>
          <div class="mt-8 flex flex-col sm:flex-row gap-4">
            <a href="#" class="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30">
              Start Free Trial
            </a>
            <a href="#" class="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-700 text-base font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
              View Documentation
            </a>
          </div>
          <div class="mt-8 flex items-center space-x-6">
            <div class="flex -space-x-2">
              ${[1,2,3,4,5].map(i => `<div class="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full border-2 border-white"></div>`).join('')}
            </div>
            <div>
              <div class="flex items-center space-x-1">
                ${[1,2,3,4,5].map(() => `<span class="text-yellow-400">★</span>`).join('')}
              </div>
              <p class="text-sm text-gray-600">Trusted by 10,000+ developers</p>
            </div>
          </div>
        </div>
        <div class="relative">
          <div class="bg-white rounded-2xl shadow-2xl p-6 border border-gray-100">
            <div class="flex items-center space-x-2 mb-4">
              <div class="w-3 h-3 bg-red-500 rounded-full"></div>
              <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div class="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <pre class="text-sm text-gray-800 overflow-x-auto"><code>npx classpresso optimize --dir dist

☕ Optimizing build output...

✓ Found 74 patterns
✓ Consolidated 943 classes
✓ Saved 41.6 KB (46% smaller)

Done in 0.3s</code></pre>
          </div>
        </div>
      </div>
    </div>
  </section>`;

// Stats Section
const stats = `
  <section class="bg-white py-16 border-y border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-8">
        <div class="text-center">
          <p class="text-4xl font-bold text-gray-900">66%</p>
          <p class="mt-2 text-sm font-medium text-gray-600">HTML Size Reduction</p>
        </div>
        <div class="text-center">
          <p class="text-4xl font-bold text-gray-900">30%</p>
          <p class="mt-2 text-sm font-medium text-gray-600">Faster Page Load</p>
        </div>
        <div class="text-center">
          <p class="text-4xl font-bold text-gray-900">10K+</p>
          <p class="mt-2 text-sm font-medium text-gray-600">Happy Developers</p>
        </div>
        <div class="text-center">
          <p class="text-4xl font-bold text-gray-900">20+</p>
          <p class="mt-2 text-sm font-medium text-gray-600">Frameworks Supported</p>
        </div>
      </div>
    </div>
  </section>`;

// Features Section
const features = `
  <section id="features" class="bg-gray-50 py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900">Everything you need</h2>
        <p class="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">Powerful features to optimize your Tailwind CSS at build time with zero runtime overhead.</p>
      </div>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        ${[
          { icon: '⚡', title: 'Lightning Fast', desc: 'Optimizes your build in milliseconds, not seconds. Zero impact on development workflow.' },
          { icon: '🎯', title: 'Smart Detection', desc: 'Automatically finds repeated class patterns across your entire codebase.' },
          { icon: '🔒', title: 'SSR Safe', desc: 'Works with server-side rendering. Prevents hydration mismatches in Next.js, Nuxt, and more.' },
          { icon: '📦', title: 'Zero Config', desc: 'Works out of the box with sensible defaults. Customize when you need to.' },
          { icon: '🧹', title: 'CSS Purging', desc: 'Optionally remove unused CSS classes after consolidation for maximum savings.' },
          { icon: '📊', title: 'Detailed Reports', desc: 'See exactly what was optimized with comprehensive manifests and metrics.' },
        ].map(f => `
        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
          <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl mb-4">${f.icon}</div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">${f.title}</h3>
          <p class="text-gray-600 text-sm leading-relaxed">${f.desc}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>`;

// Products/Cards Section (using varied cards)
function generateCards() {
  const cardTypes = [
    // Product Card
    (i) => `
      <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        <div class="h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <span class="text-white text-5xl">📦</span>
        </div>
        <div class="p-6">
          <h3 class="text-lg font-semibold text-gray-900">Product ${i + 1}</h3>
          <p class="mt-2 text-sm text-gray-500 line-clamp-2">Premium quality product with exceptional features and support.</p>
          <div class="mt-4 flex items-center justify-between">
            <span class="text-2xl font-bold text-gray-900">$${randomNumber(29, 199)}</span>
            <button class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Add to Cart</button>
          </div>
        </div>
      </div>`,
    // User Card
    (i) => `
      <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
        <div class="flex items-center space-x-4">
          <div class="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
            <span class="text-white font-bold text-lg">${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 5) % 26))}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-lg font-semibold text-gray-900 truncate">${randomName()}</p>
            <p class="text-sm text-gray-500">Senior Developer</p>
          </div>
        </div>
        <div class="mt-4 flex space-x-2">
          <button class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex-1">Message</button>
          <button class="inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex-1">Profile</button>
        </div>
      </div>`,
    // Stats Card
    (i) => `
      <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500 uppercase tracking-wide">Metric ${i + 1}</p>
            <p class="mt-2 text-3xl font-bold text-gray-900">${randomNumber(1000, 99999).toLocaleString()}</p>
          </div>
          <div class="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <span class="text-green-600 text-xl">↑</span>
          </div>
        </div>
        <div class="mt-4">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">+${randomNumber(5, 45)}%</span>
          <span class="ml-2 text-sm text-gray-500">vs last month</span>
        </div>
      </div>`,
  ];

  let cards = [];
  for (let i = 0; i < 12; i++) {
    cards.push(cardTypes[i % cardTypes.length](i));
  }
  return cards.join('\n');
}

const cardsSection = `
  <section class="bg-white py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900">Featured Products</h2>
        <p class="mt-4 text-lg text-gray-600">Discover our most popular items</p>
      </div>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        ${generateCards()}
      </div>
    </div>
  </section>`;

// Testimonials Section
const testimonials = `
  <section id="testimonials" class="bg-gray-50 py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900">Loved by developers</h2>
        <p class="mt-4 text-lg text-gray-600">See what our users have to say</p>
      </div>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        ${[
          { quote: "Classpresso reduced our bundle size by 60%. The performance improvement was immediately noticeable.", name: "Sarah Chen", role: "Lead Developer at TechCorp" },
          { quote: "Finally, a tool that handles the AI-generated Tailwind bloat. This is a game changer for our workflow.", name: "Mike Johnson", role: "CTO at StartupXYZ" },
          { quote: "We integrated it into our CI/CD pipeline. Zero config, zero hassle, massive savings.", name: "Emily Park", role: "DevOps Engineer at CloudBase" },
          { quote: "The SSR support is flawless. Works perfectly with our Next.js app without any hydration issues.", name: "David Lee", role: "Senior Developer at WebAgency" },
          { quote: "I was skeptical at first, but the benchmark results speak for themselves. 30% faster page loads.", name: "Lisa Wang", role: "Performance Engineer at FastSite" },
          { quote: "Simple CLI, great documentation, and it just works. Exactly what we needed.", name: "James Miller", role: "Freelance Developer" },
        ].map(t => `
        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
          <div class="flex items-center space-x-1 mb-4">
            ${[1,2,3,4,5].map(() => `<span class="text-yellow-400 text-lg">★</span>`).join('')}
          </div>
          <p class="text-gray-700 text-sm italic leading-relaxed">"${t.quote}"</p>
          <div class="mt-6 flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full"></div>
            <div>
              <p class="text-sm font-semibold text-gray-900">${t.name}</p>
              <p class="text-xs text-gray-500">${t.role}</p>
            </div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </section>`;

// Pricing Section
const pricing = `
  <section id="pricing" class="bg-white py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900">Simple, transparent pricing</h2>
        <p class="mt-4 text-lg text-gray-600">Choose the plan that's right for you</p>
      </div>
      <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        ${[
          { name: 'Free', price: '0', desc: 'For personal projects', features: ['Up to 3 projects', 'Basic optimization', 'Community support', 'CLI access'], popular: false },
          { name: 'Pro', price: '29', desc: 'For professional developers', features: ['Unlimited projects', 'Advanced optimization', 'Priority support', 'CI/CD integration', 'Custom rules'], popular: true },
          { name: 'Enterprise', price: '99', desc: 'For large teams', features: ['Everything in Pro', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'On-premise option'], popular: false },
        ].map(p => `
        <div class="bg-white rounded-xl shadow-md p-8 hover:shadow-lg transition-shadow ${p.popular ? 'ring-2 ring-blue-500 relative' : ''}">
          ${p.popular ? '<span class="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">Most Popular</span>' : ''}
          <h3 class="text-xl font-semibold text-gray-900">${p.name}</h3>
          <p class="mt-2 text-sm text-gray-500">${p.desc}</p>
          <div class="mt-6">
            <span class="text-4xl font-bold text-gray-900">$${p.price}</span>
            <span class="text-gray-500">/month</span>
          </div>
          <ul class="mt-8 space-y-4">
            ${p.features.map(f => `<li class="flex items-center text-sm text-gray-600"><span class="text-green-500 mr-3">✓</span>${f}</li>`).join('')}
          </ul>
          <button class="mt-8 w-full inline-flex items-center justify-center px-4 py-3 ${p.popular ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} text-sm font-medium rounded-lg transition-colors">
            ${p.price === '0' ? 'Get Started Free' : 'Start Free Trial'}
          </button>
        </div>`).join('')}
      </div>
    </div>
  </section>`;

// FAQ Section
const faq = `
  <section id="faq" class="bg-gray-50 py-20">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold text-gray-900">Frequently asked questions</h2>
        <p class="mt-4 text-lg text-gray-600">Everything you need to know</p>
      </div>
      <div class="space-y-4">
        ${[
          { q: 'How does Classpresso work?', a: 'Classpresso scans your build output, finds repeated class patterns, and replaces them with short hash names. It then generates CSS that maps those hashes to the original utility styles.' },
          { q: 'Does it work with SSR frameworks?', a: 'Yes! Use the --ssr flag to ensure only patterns found in both server and client bundles are consolidated, preventing hydration mismatches.' },
          { q: 'Will it break my styles?', a: 'No. Classpresso preserves the exact same styling - it just uses shorter class names. The generated CSS contains the same declarations as your original utilities.' },
          { q: 'What frameworks are supported?', a: 'Classpresso works with any framework that outputs HTML/JS: Next.js, Vite, Angular, SvelteKit, Astro, Remix, Nuxt, and 15+ more.' },
          { q: 'Is there a performance impact at runtime?', a: 'Zero runtime impact. All optimization happens at build time. Your users get smaller files and faster rendering with no JavaScript overhead.' },
        ].map(item => `
        <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
          <h3 class="text-lg font-semibold text-gray-900">${item.q}</h3>
          <p class="mt-3 text-gray-600 text-sm leading-relaxed">${item.a}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>`;

// CTA Section
const cta = `
  <section class="bg-gradient-to-r from-blue-600 to-purple-600 py-20">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h2 class="text-3xl sm:text-4xl font-bold text-white">Ready to optimize your build?</h2>
      <p class="mt-4 text-lg text-blue-100">Start reducing your bundle size in minutes. No credit card required.</p>
      <div class="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <a href="#" class="inline-flex items-center justify-center px-6 py-3 bg-white text-blue-600 text-base font-medium rounded-lg hover:bg-blue-50 transition-colors">
          Get Started Free
        </a>
        <a href="#" class="inline-flex items-center justify-center px-6 py-3 bg-transparent text-white text-base font-medium rounded-lg border border-white/30 hover:bg-white/10 transition-colors">
          View on GitHub
        </a>
      </div>
    </div>
  </section>`;

// Footer
const footer = `
  <footer class="bg-gray-900 py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid md:grid-cols-4 gap-8">
        <div>
          <div class="flex items-center space-x-2 mb-4">
            <div class="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-sm">CP</span>
            </div>
            <span class="text-xl font-bold text-white">Classpresso</span>
          </div>
          <p class="text-gray-400 text-sm">Build-time CSS optimization for utility-first frameworks.</p>
        </div>
        ${[
          { title: 'Product', links: ['Features', 'Pricing', 'Documentation', 'Changelog'] },
          { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
          { title: 'Legal', links: ['Privacy', 'Terms', 'License', 'Security'] },
        ].map(col => `
        <div>
          <h4 class="text-white font-semibold mb-4">${col.title}</h4>
          <ul class="space-y-2">
            ${col.links.map(link => `<li><a href="#" class="text-gray-400 text-sm hover:text-white transition-colors">${link}</a></li>`).join('')}
          </ul>
        </div>`).join('')}
      </div>
      <div class="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between">
        <p class="text-gray-400 text-sm">© 2024 Classpresso. All rights reserved.</p>
        <div class="flex items-center space-x-6 mt-4 md:mt-0">
          ${['Twitter', 'GitHub', 'Discord'].map(social => `<a href="#" class="text-gray-400 text-sm hover:text-white transition-colors">${social}</a>`).join('')}
        </div>
      </div>
    </div>
  </footer>`;

// Generate full page
function generatePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Classpresso - Build-time CSS Optimization</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="bg-white min-h-screen">
  ${navigation}
  ${hero}
  ${stats}
  ${features}
  ${cardsSection}
  ${testimonials}
  ${pricing}
  ${faq}
  ${cta}
  ${footer}
</body>
</html>`;
}

// Create dist folder and generate
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

const html = generatePage();
fs.writeFileSync('dist/index.html', html);
console.log(`Generated full website with:`);
console.log(`  - Navigation bar`);
console.log(`  - Hero section`);
console.log(`  - Stats section`);
console.log(`  - Features section (6 cards)`);
console.log(`  - Products section (12 cards)`);
console.log(`  - Testimonials section (6 cards)`);
console.log(`  - Pricing section (3 cards)`);
console.log(`  - FAQ section (5 items)`);
console.log(`  - CTA section`);
console.log(`  - Footer`);
console.log(`File size: ${(Buffer.byteLength(html, 'utf-8') / 1024).toFixed(2)} KB`);
