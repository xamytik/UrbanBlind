const CACHE_NAME = 'urbanblind-v1';
const urlsToCache = [
  '/',
  '/css/styles.css',
  '/js/main.js',
  '/js/modules/config.js',
  '/js/modules/utils.js',
  '/js/modules/weather.js',
  '/js/modules/traffic.js',
  '/js/modules/noise.js',
  '/js/modules/crowd.js',
  '/js/modules/light.js',
  '/js/modules/ui.js',
  '/js/modules/map.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});