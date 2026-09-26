const CACHE_NAME = 'viaggio-home-v45-flat-day-camera';
const SUPABASE_CLIENT = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
const EXTERNAL_ASSETS = [SUPABASE_CLIENT, LEAFLET_CSS, LEAFLET_JS];
const APP_SHELL = [
  './',
  './index.html',
  './style.css?v=20260925-15',
  './src/main.js?v=20260925-19',
  './src/offline-store.js',
  './manifest.webmanifest',
  './assets/app-icon.svg',
  './assets/cintia.png',
  './assets/paulo.jpeg',
  './assets/splash-plane.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all([
        cache.addAll(APP_SHELL),
        ...EXTERNAL_ASSETS.map(url => cache.add(url).catch(() => undefined))
      ]))
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
  const isExternalAsset = EXTERNAL_ASSETS.includes(url.href);
  const isImage = event.request.destination === 'image';

  if (url.origin !== self.location.origin && !isExternalAsset && !isImage) return;

  if (isImage && url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const refreshed = fetch(event.request)
          .then(response => {
            if (response.ok || response.type === 'opaque') {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
            }
            return response;
          })
          .catch(() => cached);
        return cached || refreshed;
      })
    );
    return;
  }

  if (event.request.mode !== 'navigate') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const refreshed = fetch(event.request).then(response => {
          if (response.ok || response.type === 'opaque') {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
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
