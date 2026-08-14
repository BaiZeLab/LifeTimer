"use client";

import { useEffect } from "react";

// Mirrors public/sw.js — must stay in sync.
const NAV_CACHE = "lt-pending-nav";
const NAV_KEY = "/__pending-nav__";
const NAV_MAX_AGE_MS = 60_000;

function goTo(absoluteUrl: string) {
  try {
    const target = new URL(absoluteUrl, window.location.origin);
    if (target.href !== window.location.href) window.location.href = target.href;
  } catch {
    // Malformed URL from an unexpected payload — ignore rather than crash.
  }
}

/**
 * Renders nothing; exists purely to receive the service worker's
 * notification-click navigation regardless of which page happens to be
 * mounted. See public/sw.js "Notification click" for the full rationale:
 *
 *   1. App was already open (foreground or background) — the SW posts a
 *      "lt-navigate" message directly; WindowClient.navigate() is not used
 *      because it is unreliable across browsers for this.
 *   2. App was fully closed — iOS Safari has a long-standing bug where
 *      clients.openWindow(url) sometimes ignores `url` and reopens start_url
 *      instead. The SW leaves the intended URL in a small Cache Storage
 *      entry before that call; this component recovers it on first mount.
 */
export function PushNavigationHandler() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "lt-navigate" && typeof event.data.url === "string") {
        goTo(event.data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    (async () => {
      try {
        if (!("caches" in window)) return;
        const cache = await caches.open(NAV_CACHE);
        const res = await cache.match(NAV_KEY);
        if (!res) return;
        await cache.delete(NAV_KEY);
        const { url, ts } = (await res.json()) as { url?: string; ts?: number };
        if (url && typeof ts === "number" && Date.now() - ts < NAV_MAX_AGE_MS) goTo(url);
      } catch {
        // Cache Storage unavailable or entry malformed — nothing to recover.
      }
    })();

    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  return null;
}
