/**
 * Life Timer Service Worker
 *
 * Strategy:
 *   - Static assets (/_next/static/…, /icons/…): Cache-First
 *   - HTML pages: Network-First (always fresh content)
 *   - API routes (/api/…): Network-Only (never cache)
 *   - Push events: show notification and open app on click
 */

const CACHE_VERSION = "lt-v1";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("lt-") && k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API routes — always network
  if (url.pathname.startsWith("/api/")) return;

  // Static assets — cache first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          return res;
        })
      )
    );
    return;
  }

  // HTML pages — network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// ── Push notification ─────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = { title: "Life Timer", body: "有条目即将到期或耗尽", tag: "lt-alert" };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    "/icons/icon-192.png",
      badge:   "/icons/icon-192.png",
      tag:     data.tag ?? "lt-alert",
      renotify: true,
      data:    { url: data.url ?? "/" },
      actions: [
        { action: "open", title: "查看详情" },
        { action: "dismiss", title: "忽略" },
      ],
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
