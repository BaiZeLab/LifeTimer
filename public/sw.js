/**
 * Life Timer Service Worker
 *
 * Strategy:
 *   - Static assets (/_next/static/…, /icons/…): Cache-First
 *   - HTML pages: Network-First (always fresh content)
 *   - API routes (/api/…): Network-Only (never cache)
 *   - Push events: show notification and open app on click
 */

// Bump this version whenever sw.js logic changes to force all clients to
// activate the new worker and clear the old cache.
const CACHE_VERSION = "lt-v5";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
// Not version-bound — a single small dead-drop entry, not a versioned asset
// cache, so it must survive the activate-time cleanup below.
const NAV_CACHE = "lt-pending-nav";

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
            .filter((k) => k.startsWith("lt-") && k !== STATIC_CACHE && k !== NAV_CACHE)
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
          // Only cache successful responses — never cache 4xx/5xx or redirects
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // HTML pages — network first, fall back to cache
  // Only cache 200 responses; auth redirects (302→/auth/login) must never be
  // cached, otherwise a logged-out user's redirect would be served to a
  // subsequently logged-in user in offline mode.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
        }
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
//
// WindowClient.navigate() is unreliable across browsers for this (throws or
// silently no-ops in some states — see webkit.org bug tracking), so an
// existing window is redirected via postMessage instead; the page listens
// and does the actual navigation client-side. iOS Safari has a further,
// still-unfixed bug: when the PWA was fully closed, clients.openWindow(url)
// sometimes ignores `url` entirely and reopens start_url. NAV_CACHE is a
// same-origin dead-drop the freshly-opened page reads on boot to recover the
// intended destination in that case (see PushNavigationHandler component).
const NAV_KEY = "/__pending-nav__";

async function rememberPendingNav(url) {
  try {
    const cache = await caches.open(NAV_CACHE);
    await cache.put(NAV_KEY, new Response(JSON.stringify({ url, ts: Date.now() })));
  } catch {
    // Cache Storage unavailable (e.g. private mode) — the postMessage /
    // openWindow paths below still cover the common cases.
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = new URL(event.notification.data?.url ?? "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      await rememberPendingNav(targetUrl);

      const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windowClients.find((c) => c.url.startsWith(self.location.origin));

      if (existing) {
        existing.postMessage({ type: "lt-navigate", url: targetUrl });
        try {
          await existing.focus();
        } catch {
          // iOS can throw "focus failed" right as a killed PWA relaunches;
          // the message above and the NAV_CACHE fallback still apply once
          // the page settles.
        }
        return;
      }

      return self.clients.openWindow(targetUrl);
    })()
  );
});
