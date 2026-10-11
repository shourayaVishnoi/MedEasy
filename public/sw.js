// Minimal service worker: caches the app shell for faster loads.
// Medical data and API responses are never cached here, and offline actions
// are not reported as synced.
const SHELL = "healthos-shell-v2";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(["/", "/icon.svg", "/manifest.webmanifest"])));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put(e.request, copy));
      return res;
    })));
  }
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/app/medicines";
  e.waitUntil(self.clients.openWindow(url));
});
// Reminder pushes carry no medical details; the text is generic by design.
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title || "HealthOS reminder", {
      body: data.body || "You have a scheduled dose now. Open HealthOS to record it.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.tag || "healthos-reminder",
      data: { url: data.url || "/app/medicines" },
    }),
  );
});
