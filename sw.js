const CACHE_NAME = "colins-charts-macros-v3";
const ASSETS_TO_CACHE = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./database.js",
  "./scanner.js",
  "./charts.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./screenshot.png",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://unpkg.com/html5-qrcode"
];

// Install Event - Caching all core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clearing old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Serve cached assets when offline, network first with cache fallback
self.addEventListener("fetch", (event) => {
  // Only cache GET requests
  if (event.request.method !== "GET") return;

  // Skip Open Food Facts API calls (should always be live)
  if (event.request.url.includes("openfoodfacts.org")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If network request is successful, update cache and return response
        if (networkResponse && networkResponse.status === 200) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheCopy);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network request fails (offline mode)
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache, return default offline experience
          return new Response("Offline content unavailable.", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({ "Content-Type": "text/plain" })
          });
        });
      })
  );
});
