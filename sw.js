const CACHE = 'sticky-notes-c7029db6354e6af38d03cd4c04782d735de79726';

const ASSETS = [
  './',
  './index.html',
  './note.html',
  './manifest.json',
  './js/storage.js',
  './js/barcode.js',
  './js/render.js',
  './css/index.css',
  './css/note.css',
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
  // Network-first for CDN resources; cache-first for app shell
  const url = new URL(e.request.url);
  const isLocal = url.origin === self.location.origin;

  if (isLocal) {
    // Cache-first for local assets
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  } else {
    // Network-first for CDN, fall back to cache
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});
