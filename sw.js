// Fun Money service worker
//
// Update strategy:
// - Navigations are network-first so an online launch receives the newest HTML.
// - A short timeout falls back to the cached app shell on slow or unavailable networks.
// - Static assets use stale-while-revalidate for fast, offline-capable loading.
// - The page decides when a waiting worker may activate, preventing updates from
//   interrupting a user who has already started interacting with the app.
//
// Budget data is stored separately in localStorage and is never read, changed,
// or deleted by this service worker.

var CACHE_PREFIX = 'fun-money-';
var CACHE_NAME = CACHE_PREFIX + 'shell-v2';
var OFFLINE_URL = './index.html';
var NAVIGATION_TIMEOUT_MS = 4000;

var REQUIRED_SHELL = [
  OFFLINE_URL,
  './manifest.json'
];

var OPTIONAL_SHELL = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png'
];

function cacheFresh(cache, url) {
  var request = new Request(url, { cache: 'reload' });
  return fetch(request).then(function(response) {
    if (!response || !response.ok) {
      throw new Error('Could not cache ' + url);
    }
    return cache.put(url, response);
  });
}

function isCacheable(response) {
  return !!response && response.ok && response.type === 'basic';
}

function cachedNavigationFallback(request) {
  return caches.open(CACHE_NAME).then(function(cache) {
    return cache.match(request, { ignoreSearch: true }).then(function(response) {
      return response || cache.match(OFFLINE_URL);
    });
  });
}

function networkFirstNavigation(event) {
  var request = event.request;

  // Bypass the browser HTTP cache for the document itself. This is what makes
  // routine HTML deployments appear on the first normal online launch.
  var networkResponse = fetch(request, { cache: 'no-store' }).then(function(response) {
    if (!isCacheable(response)) return response;

    // Keep one canonical app-shell document for offline fallback. Waiting for
    // this tiny cache write keeps the update reliable if the worker is stopped.
    return caches.open(CACHE_NAME).then(function(cache) {
      return cache.put(OFFLINE_URL, response.clone()).catch(function() {}).then(function() {
        return response;
      });
    });
  });

  // If the cached page wins the timeout race, allow the network request to
  // finish in the background and refresh the offline copy for the next launch.
  event.waitUntil(networkResponse.then(function() {}, function() {}));

  var timeout = new Promise(function(resolve) {
    setTimeout(function() { resolve(null); }, NAVIGATION_TIMEOUT_MS);
  });

  return Promise.race([networkResponse, timeout]).then(function(response) {
    if (response) return response;

    return cachedNavigationFallback(request).then(function(cached) {
      // A first-ever visit has no cached fallback, so keep waiting for network.
      return cached || networkResponse;
    });
  }).catch(function() {
    return cachedNavigationFallback(request).then(function(cached) {
      return cached || Response.error();
    });
  });
}

function staleWhileRevalidate(event) {
  var request = event.request;

  return caches.open(CACHE_NAME).then(function(cache) {
    return cache.match(request).then(function(cached) {
      var networkUpdate = fetch(request).then(function(response) {
        if (isCacheable(response)) {
          return cache.put(request, response.clone()).catch(function() {}).then(function() {
            return response;
          });
        }
        return response;
      });

      event.waitUntil(networkUpdate.then(function() {}, function() {}));
      return cached || networkUpdate;
    });
  });
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Core files are required. If either cannot be fetched, the current
      // service worker remains active rather than installing a broken update.
      return Promise.all(REQUIRED_SHELL.map(function(url) {
        return cacheFresh(cache, url);
      })).then(function() {
        // Missing icons should not prevent the app itself from updating.
        return Promise.all(OPTIONAL_SHELL.map(function(url) {
          return cacheFresh(cache, url).catch(function() {});
        }));
      });
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        // Never delete unrelated caches belonging to another app on the origin.
        if (key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// The page sends this only when activating the update cannot interrupt the user.
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', function(event) {
  var request = event.request;

  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(event));
    return;
  }

  event.respondWith(staleWhileRevalidate(event));
});
