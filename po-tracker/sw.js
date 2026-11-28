// Bump CACHE_VERSION whenever app files change so installed apps update.
const CACHE_VERSION = "po-tracker-v8";
const ASSETS = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.startsWith("po-tracker-") && k !== CACHE_VERSION).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Network first so updates show up; cache when offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && new URL(e.request.url).origin === location.origin) {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
});
