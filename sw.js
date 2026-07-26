// Fun Money service worker
//
// Caches the app on first visit so it launches instantly and works with no
// network connection. Your budget data itself lives in localStorage and is
// untouched by any of this - this only caches the app's files.
//
// Strategy: stale-while-revalidate. Every launch serves the cached copy
// immediately (fast, and works offline), then quietly fetches a fresh copy in
// the background for next time. That means a deploy shows up on the SECOND
// launch after you publish it, not the first.
//
// Bump CACHE_VERSION below to force every device to discard its cache and
// re-download everything. You don't need to do this for routine updates - it's
// the lever for when you want a change to land as fast as possible.

var CACHE_VERSION = 'fun-money-v1';

var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      // Cache entries individually so one missing file (say, an icon that
      // didn't get uploaded) can't break offline support for the whole app.
      return Promise.all(PRECACHE_URLS.map(function(url) {
        return cache.add(url).catch(function() {});
      }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        if (key !== CACHE_VERSION) return caches.delete(key);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var request = event.request;

  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.match(request).then(function(cached) {
        var networkFetch = fetch(request).then(function(response) {
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(function() {
          // Offline. Fall back to the cached copy, or to the app shell for
          // navigations so a cold URL still opens the app rather than an error.
          if (cached) return cached;
          if (request.mode === 'navigate') return cache.match('./index.html');
          return Response.error();
        });

        return cached || networkFetch;
      });
    })
  );
});
