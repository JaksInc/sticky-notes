const CACHE = 'sticky-notes-7d65ba4f0e6c84b77c32472c06ad5e8d84c62249';

const ASSETS = [
  './',
  './index.html',
  './notes.html',
  './note.html',
  './manifest.json',
  './js/storage.js',
  './js/barcode.js',
  './js/render.js',
  './js/dashboard.js',
  './js/icons.js',
  './css/tokens.css',
  './css/index.css',
  './css/note.css',
  './css/dashboard.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isLocal = url.origin === self.location.origin;

  if (!isLocal) {
    // Network-first for CDN, fall back to cache
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Network-first for page navigations so the app shell is always fresh
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for JS, CSS, images and other static assets
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});
