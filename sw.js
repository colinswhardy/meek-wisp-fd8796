const CACHE_NAME = "colins-charts-macros-v8";
const ASSETS_TO_CACHE = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./state.js",
  "./router.js",
  "./database.js",
  "./scanner.js",
  "./charts.js",
  "./controllers/calendar.js",
  "./controllers/dashboard.js",
  "./controllers/food.js",
  "./controllers/food_selector.js",
  "./controllers/recipe.js",
  "./controllers/settings.js",
  "./controllers/strategy.js",
  "./controllers/weight.js",
  "./controllers/scanner_view.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./screenshot.png",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://unpkg.com/html5-qrcode"
];

// Install Event - Caching all core assets using async/await
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    console.log("[Service Worker] Caching app assets...");
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS_TO_CACHE);
  })());
  self.skipWaiting();
});

// Activate Event - Clearing old caches using async/await
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(async (key) => {
        if (key !== CACHE_NAME) {
          console.log("[Service Worker] Removing old cache:", key);
          await caches.delete(key);
        }
      })
    );
  })());
  self.clients.claim();
});

// Fetch Event - Serve cached assets when offline, network first with cache fallback
self.addEventListener("fetch", (event) => {
  // Only cache GET requests
  if (event.request.method !== "GET") return;

  // Skip external API calls (should always be live)
  if (event.request.url.includes("openfoodfacts.org") || event.request.url.includes("api.nal.usda.gov")) {
    return;
  }

  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(event.request);
      
      // If network request is successful, update cache and return response
      if (networkResponse && networkResponse.status === 200) {
        const cacheCopy = networkResponse.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, cacheCopy);
      }
      return networkResponse;
    } catch (err) {
      // Fallback to cache if network request fails (offline mode)
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If not in cache, return default offline experience
      return new Response("Offline content unavailable.", {
        status: 503,
        statusText: "Service Unavailable",
        headers: new Headers({ "Content-Type": "text/plain" })
      });
    }
  })());
});
