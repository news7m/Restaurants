const CACHE_NAME = 'greatertunis-static-v8';
const DATA_CACHE_NAME = 'greatertunis-data-v1';
const TILE_CACHE_NAME = 'greatertunis-tiles-v1';
const MAX_TILES_CACHE = 150;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './restaurants.json',
  './tunis_restaurants.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './screenshot-desktop.png',
  './screenshot-mobile.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Pre-caching core app shell & static assets');
      await Promise.allSettled(
        ASSETS_TO_CACHE.map(async (url) => {
          try {
            const req = new Request(url, { mode: url.startsWith('http') ? 'no-cors' : 'same-origin' });
            const response = await fetch(req);
            if (response && (response.ok || response.type === 'opaque')) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn('[Service Worker] Failed to pre-cache asset gracefully:', url, err);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate Event & Navigation Preload
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating new Service Worker version');
  const allowedCaches = [CACHE_NAME, DATA_CACHE_NAME, TILE_CACHE_NAME];
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (!allowedCaches.includes(cache)) {
              console.log('[Service Worker] Deleting outdated cache:', cache);
              return caches.delete(cache);
            }
          })
        );
      }),
      // Enable Navigation Preload if supported (Google/Microsoft PWA Best Practice)
      self.registration.navigationPreload
        ? self.registration.navigationPreload.enable()
        : Promise.resolve()
    ]).then(() => self.clients.claim())
  );
});

// Message Listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper: Trim Cache size
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    trimCache(cacheName, maxItems);
  }
}

// Helper: Fetch with Timeout
function fetchWithTimeout(request, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), timeoutMs);
    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Fetch Event Listener
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Navigation Requests (HTML Documents) with Navigation Preload support
  if (event.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      (async () => {
        try {
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) return preloadResponse;

          const networkResponse = await fetchWithTimeout(event.request, 3000);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;
          return caches.match('./index.html');
        }
      })()
    );
    return;
  }

  // 2. OpenStreetMap Tiles: Cache-First with Size Management
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
            trimCache(TILE_CACHE_NAME, MAX_TILES_CACHE);
          }
          return networkResponse;
        } catch (err) {
          // Offline tile fallback
          return new Response('', { status: 404, statusText: 'Offline Tile Unavailable' });
        }
      })
    );
    return;
  }

  // 3. Dataset JSON files: Stale-While-Revalidate
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetchWithTimeout(event.request, 3000)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. Static Assets (CSS, JS, Fonts, Icons): Cache-First Strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        }
        return networkResponse;
      }).catch(() => {
        // Silent failure for static assets when offline
      });
    })
  );
});
