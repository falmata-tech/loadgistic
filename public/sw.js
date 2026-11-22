const CACHE = 'loadgistic-static-v9';
const OFFLINE = '/pwa-offline.html';
const STATIC = [OFFLINE, '/pwa-offline.css', '/pwa-offline.js', '/manifest.webmanifest', '/icon.svg', '/favicon-32.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('loadgistic-static-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return await cache.match(OFFLINE) || Response.error();
    }));
    return;
  }
  const cacheable = STATIC.includes(url.pathname)
    || url.pathname.startsWith('/vehicle-configurations/');
  if (url.search) return;
  if (!cacheable) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request,copy));
      }
      return response;
    }))
  );
});
