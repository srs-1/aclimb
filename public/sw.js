const CACHE = "aclimb-static-v4";
const DECORATIVE_ASSETS = ["/icon.svg", "/woodland-route.png", "/mountain-route.png", "/lakeside-route.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(DECORATIVE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("aclimb-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Page HTML must be network-first so it always matches Next.js' versioned JS chunks.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Refresh decorative artwork from the network and use the cache only when offline.
  if (DECORATIVE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
self.addEventListener("push", (event) => {
  event.waitUntil(self.registration.showNotification("ACLimb", { body: "Your ACLimb session is ready.", icon: "/icon.svg", badge: "/icon.svg" }));
});
