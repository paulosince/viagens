const CACHE_NAME = 'viaggio-home-v24';
const APP_SHELL = [
  './',
  './index.html',
  './style.css?v=20260720-33',
  './src/main.js?v=20260720-34',
  './manifest.webmanifest',
  './assets/app-icon.svg',
  './assets/cintia.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode !== 'navigate') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const refreshed = fetch(event.request).then(response => {
          if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          return response;
        }).catch(() => cached);
        return cached || refreshed;
      })
    );
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
