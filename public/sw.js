const CACHE = 'loadgistic-static-v6';
const STATIC = ['/manifest.webmanifest', '/icon.svg', '/favicon-32.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode === 'navigate') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const cacheable = url.pathname === '/icon.svg'
    || url.pathname === '/favicon-32.png'
    || url.pathname === '/icon-192.png'
    || url.pathname === '/icon-512.png'
    || url.pathname === '/icon-maskable-512.png'
    || url.pathname === '/apple-touch-icon.png'
    || url.pathname === '/manifest.webmanifest'
    || url.pathname.startsWith('/vehicle-configurations/');
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
