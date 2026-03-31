// MyRight Service Worker v2 — Offline-first PWA
const CACHE = 'myright-v2';
const STATIC = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/main.js',
  '/js/sw-register.js',
  '/manifest.json',
  '/icons/favicon.ico',
  '/icons/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/pages/login.html',
  '/pages/signup.html',
  '/pages/dashboard.html',
  '/pages/generate.html',
  '/pages/history.html',
  '/pages/profile.html',
  '/pages/subscription.html',
  '/pages/forgot.html',
  '/pages/privacy.html',
  '/pages/terms.html',
  '/pages/disclaimer.html',
  '/404.html'
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Activate — remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network-first for API, cache-first for assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache Firebase, Anthropic, or Razorpay API calls
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('anthropic') ||
    url.hostname.includes('razorpay') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('googleapis') ||
    e.request.method !== 'GET'
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network-first with cache fallback
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(cached => cached || caches.match('/404.html')))
  );
});
