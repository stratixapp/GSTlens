// GST Lens Service Worker v5 — Play Store Ready
const APP_VERSION = 'v5.1';
const STATIC_CACHE = 'gstlens-static-' + APP_VERSION;
const DYNAMIC_CACHE = 'gstlens-dynamic-' + APP_VERSION;

// Static assets to precache
const PRECACHE_URLS = [
  './index.html',
  './privacy.html',
  './terms.html',
  './about.html',
  './support.html',
  './manifest.json',
  './icon-48.png',
  './icon-72.png',
  './icon-96.png',
  './icon-144.png',
  './icon-192.png',
  './icon-512.png',
  './favicon.ico',
  './favicon-32.png',
];

// ── INSTALL ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE_URLS))
      .catch(err => console.warn('[SW] Precache partial fail:', err))
  );
  self.skipWaiting();
});

// ── ACTIVATE ── clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH ── tiered caching strategy
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Always network: Firebase, Gemini AI, external APIs
  const networkOnly = [
    'googleapis.com', 'firebaseio.com', 'firestore.googleapis.com',
    'identitytoolkit', 'securetoken', 'generativelanguage',
    'firebasestorage.googleapis.com', 'anthropic.com'
  ];
  if (networkOnly.some(d => url.hostname.includes(d))) return;

  // Static assets: Cache First
  const staticExts = ['.png','.jpg','.jpeg','.ico','.svg','.woff','.woff2','.ttf'];
  if (staticExts.some(ext => url.pathname.endsWith(ext)) || url.pathname.includes('manifest')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached ||
        fetch(e.request).then(res => {
          if (res.ok) caches.open(STATIC_CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() => new Response('', {status: 404}))
      )
    );
    return;
  }

  // CDN scripts (jspdf, chart.js, tesseract, xlsx): Stale While Revalidate
  if (url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('gstatic.com')) {
    e.respondWith(
      caches.open(DYNAMIC_CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const networkFetch = fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached || new Response('', {status: 503}));
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // HTML pages: Network First with offline fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request)
          .then(cached => cached || caches.match('./index.html'))
      )
  );
});

// ── BACKGROUND SYNC ──
self.addEventListener('sync', e => {
  if (e.tag === 'sync-bills') {
    e.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SYNC_BILLS' }))
      )
    );
  }
});

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch(_) { data = { title: 'GST Lens', body: e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'GST Lens', {
      body: data.body || 'You have a new notification',
      icon: './icon-192.png',
      badge: './icon-96.png',
      tag: 'gstlens',
      data: { url: data.url || './' },
      actions: [{ action: 'open', title: 'Open App' }]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      const existing = list.find(c => c.url.includes('index.html') || c.url.endsWith('/'));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});

// ── MESSAGE HANDLER ──
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'GET_VERSION') {
    e.ports[0]?.postMessage({ version: APP_VERSION });
  }
});
