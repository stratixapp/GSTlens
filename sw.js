// ═══════════════════════════════════════════════════════════════
//  GST Lens by Stratix — Service Worker  (sw.js)
//  Fixes applied:
//   1. Skip chrome-extension:// and non-http(s) URLs before Cache.put()
//   2. Always clone() response BEFORE consuming body (prevents "body already used")
//   3. Guard all fetch/cache ops with try-catch to avoid uncaught promise rejections
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME   = 'gstlens-v4';
const SHARE_CACHE  = 'gstlens-share';

// App-shell assets to precache on install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './favicon-32.png',
  './icon-192.png',
  './icon-512.png',
  './gst_error_detector.js',
  './gst_intelligence.js',
];

// ─── Helper: only cache http / https requests ───────────────────
// Fixes Error 1: Cache.put() refuses chrome-extension:// scheme
function isCacheable(request) {
  const url = new URL(request.url);
  return url.protocol === 'http:' || url.protocol === 'https:';
}

// ─── INSTALL: precache app shell ────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(
        PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' }))
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: purge old caches ─────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== SHARE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH: cache-first for app shell, network-first for others ─
self.addEventListener('fetch', event => {

  // ── Guard 1: skip non-GET and non-http(s) ──
  if (event.request.method !== 'GET') return;
  if (!isCacheable(event.request)) return;       // ← Fixes Error 1

  // ── Guard 2: skip cross-origin third-party requests we don't own ──
  // (e.g. Cloudflare CDN scripts, Firebase, etc.)
  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin;

  if (isAppShell) {
    // Cache-first strategy for local app files
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;

        // Not in cache → fetch, clone, store
        return fetch(event.request).then(response => {
          // ── Guard 3: only cache valid responses ──
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // ── Fix Error 2: clone BEFORE the body is read by the browser ──
          const responseToCache = response.clone();  // ← Fixes Error 3

          caches.open(CACHE_NAME).then(cache => {
            try {
              cache.put(event.request, responseToCache);
            } catch (e) {
              // Ignore storage-quota or scheme errors silently
              console.warn('[SW] cache.put failed:', e.message);
            }
          });

          return response;  // original (unconsumed) response goes to browser
        }).catch(() => {
          // Offline fallback — serve index.html for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
  // For cross-origin requests (Firebase, Razorpay, etc.) — let browser handle naturally
  // SW does not intercept them, so no caching errors
});

// ─── BACKGROUND SYNC: notify clients to sync bills ──────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bills') {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.postMessage({ type: 'SYNC_BILLS' }));
}

// ─── SHARE TARGET: handle incoming shared files ─────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (
    event.request.method === 'POST' &&
    url.pathname === '/' &&
    url.searchParams.get('shared') === '1'
  ) {
    event.respondWith(handleShare(event.request));
  }
});

async function handleShare(request) {
  try {
    const formData = await request.formData();
    const files    = formData.getAll('invoices');     // matches manifest share_target

    if (files.length > 0) {
      const cache = await caches.open(SHARE_CACHE);
      await Promise.all(
        files.map(async (file, i) => {
          const buffer   = await file.arrayBuffer();
          const response = new Response(buffer, {
            headers: { 'Content-Type': file.type }
          });
          await cache.put(`shared-invoice-${Date.now()}-${i}`, response);
        })
      );
    }
  } catch (e) {
    console.warn('[SW] handleShare error:', e.message);
  }

  // Redirect to app
  return Response.redirect('./?shared=1', 303);
}
