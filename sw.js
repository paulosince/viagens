const CACHE_NAME = 'viaggio-home-v121-calendar-polish';
const MEDIA_CACHE_NAME = 'viaggio-media-v1';
const NEON_MEDIA_CACHE_NAME = 'viaggio-neon-auth-preview-media-v1';
const SUPABASE_CLIENT = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
const NEON_AUTH_SDK = 'https://cdn.jsdelivr.net/npm/@neondatabase/neon-js@0.9.0-beta/+esm';
const NEON_DATA_SDK = 'https://cdn.jsdelivr.net/npm/@neondatabase/postgrest-js@0.2.0-beta/+esm';
const EXTERNAL_ASSETS = [SUPABASE_CLIENT, NEON_AUTH_SDK, NEON_DATA_SDK, LEAFLET_CSS, LEAFLET_JS];
const OPTIONAL_ASSETS = ['./src/itinerary-pdf.mjs?v=20260927-56', './vendor/pdf-lib.min.mjs'];
const APP_SHELL = [
  './',
  './index.html',
  './style.css?v=20261024-calendar9',
  './experiments/neon-pilot/app/main-neon.js?v=20261024-calendar9',
  './experiments/neon-pilot/app/backend-neon.mjs?v=20261024-home3',
  './experiments/neon-pilot/app/usage-rings.mjs?v=20261024-home3',
  './experiments/neon-pilot/app/offline-store-neon.js?v=20261021-1',
  './experiments/neon-pilot/app/media-cache-neon.js?v=20261021-1',
  './experiments/neon-pilot/app/photo-source-neon.mjs?v=20261021-7photofix',
  './experiments/neon-pilot/app/storage-neon.mjs',
  './experiments/neon-pilot/app/router-neon.mjs?v=20261024-home3',
  './experiments/neon-pilot/app/neon-identity.mjs',
  './src/offline-store.js?v=20261007-59',
  './legacy-supabase.html',
  './src/main.js?v=20261018-64',
  './src/media-cache.js?v=20261007-62',
  './src/update-manager-neon.js?v=20261024-home3',
  './src/update-manager.js?v=20261018-63',
  './src/update-manager.css?v=20261024-home3',
  './manifest.webmanifest',
  './assets/app-icon.svg',
  './assets/avatar-placeholder.svg',
  './assets/paulo.jpeg',
  './assets/splash-plane.png',
  './assets/auth-shore.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all([
        cache.addAll(APP_SHELL),
        ...EXTERNAL_ASSETS.map(url => cache.add(url).catch(() => undefined)),
        ...OPTIONAL_ASSETS.map(url => cache.add(url).catch(() => undefined))
      ]))
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'VIAGGIO_ACTIVATE_UPDATE') {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME && key !== MEDIA_CACHE_NAME && key !== NEON_MEDIA_CACHE_NAME && !(key.startsWith('viaggio-') && key.includes('media'))).map(key => caches.delete(key))))
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
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok || response.type === 'opaque') {
            caches.open(MEDIA_CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        });
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
      .then(async response => {
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
          return (await caches.match(event.request)) || (await caches.match('./index.html')) || response;
        }
        await caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, response.clone()))
          .catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
