// GST Lens by Stratix — Service Worker

const CACHE_NAME  = 'gstlens-v5';
const SHARE_CACHE = 'gstlens-share';

// Only cache http/https — never chrome-extension://
function isCacheable(req) {
  return req.url.startsWith('http://') || req.url.startsWith('https://');
}

// INSTALL: nothing to precache — avoids failing on missing assets
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

// ACTIVATE: delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== SHARE_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH: network-first with cache fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!isCacheable(event.request)) return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Share target POST handled separately below
  const url = new URL(event.request.url);
  if (url.searchParams.get('shared') === '1' && event.request.method === 'POST') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bills') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SYNC_BILLS' }))
      )
    );
  }
});

// Share target
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.searchParams.get('shared') === '1') {
    event.respondWith(
      event.request.formData().then(async formData => {
        try {
          const files = formData.getAll('invoice');
          if (files.length) {
            const cache = await caches.open(SHARE_CACHE);
            await Promise.all(files.map((file, i) =>
              file.arrayBuffer().then(buf =>
                cache.put(
                  `shared-invoice-${Date.now()}-${i}`,
                  new Response(buf, { headers: { 'Content-Type': file.type } })
                )
              )
            ));
          }
        } catch(e) {}
        return Response.redirect('./?shared=1', 303);
      }).catch(() => Response.redirect('./', 303))
    );
  }
});
