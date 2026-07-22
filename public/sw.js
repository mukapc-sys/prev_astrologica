const CACHE = "pac-v2";
const ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith("/api/")) return;               // API sempre na rede
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// ---- Push (horóscopo semanal / alertas dos astros) ----
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { body: e.data ? e.data.text() : "" }; }
  const title = data.title || "Seu horóscopo chegou ✨";
  const body = data.body || "Toque para ver o que os astros trazem para você.";
  e.waitUntil(self.registration.showNotification(title, {
    body, icon: "/icon.svg", badge: "/icon.svg", data: data.url || "/"
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data || "/"));
});
