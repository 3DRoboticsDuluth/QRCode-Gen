// sw.js - simple service worker to cache app shell for offline
const CACHE_NAME = 'ftc-qr-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/blocks_custom.js',
  '/manifest.json'
];

// install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// activate
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// fetch
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(resp => {
        // optionally cache runtime requests here
        return resp;
      });
    })
  );
});
