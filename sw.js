// Offline-Fähigkeit: Dateien liegen zusätzlich im Speicher; bei neuer Version CACHE hochzählen.
const CACHE = "budget-v8";
const FILES = ["./", "./index.html", "./budget.css?v=3", "./budget.js?v=8", "./manifest.webmanifest",
  "./icon.svg", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // Netz zuerst – so läuft immer die aktuelle Version; ohne Netz (oder nach 3 s Funkloch) aus dem Speicher
  const nav = e.request.mode === "navigate";
  const cached = () => caches.match(e.request, { ignoreSearch: nav });
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const finish = (res) => { if (!done && res) { done = true; resolve(res); } };
    const timer = setTimeout(() => cached().then(finish), 3000);
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(nav ? "./" : e.request, copy)); }
      clearTimeout(timer);
      finish(res);
    }).catch(() => cached().then((hit) => finish(hit || Response.error())));
  }));
});
