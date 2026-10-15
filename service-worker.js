/*
 * CCIS Scheduling System — Service Worker
 * Enables "Install App" / desktop app behavior (PWA) and basic offline support.
 *
 * Strategy:
 *  - api/*.php  -> network-only (always fresh; scheduling data must never be stale/cached)
 *  - HTML pages -> network-first, falling back to cache, then to offline.html
 *  - static assets (css/js/images + same fonts/icons from CDN) -> stale-while-revalidate
 */

const VERSION = 'ccis-v14';
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;

const CORE_ASSETS = [
  'dashboard.html',
  'offline.html',
  'manifest.webmanifest',
  'css/core/style.css',
  'css/dashboard/dashboard.css',
  'js/dashboard/dashboard.js',
  'images/branding/ccis-banner.jpg',
  'images/icons/icon-192.png',
  'images/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {}) // don't block install if a CDN asset is unreachable
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('ccis-') && key !== STATIC_CACHE && key !== PAGES_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isApiRequest(url) {
  return url.pathname.includes('/api/') && url.pathname.endsWith('.php');
}

function isHtmlRequest(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // let POST/PUT/DELETE (form saves) pass straight through

  const url = new URL(request.url);

  // Never cache API/database calls — schedules must always be current.
  if (isApiRequest(url)) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ error: 'offline', message: 'You are offline. Reconnect to load live data.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // HTML navigations: network-first, cache fallback, offline page as last resort.
  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('offline.html'))
        )
    );
    return;
  }

  // Static assets (css/js/images/fonts): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
