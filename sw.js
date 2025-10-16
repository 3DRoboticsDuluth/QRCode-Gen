self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open('ftc-qrcode-cache').then(function(cache) {
      return cache.addAll([
        './index.html',
        './styles.css',
        './blocks_custom.js',
        './app.js'
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
