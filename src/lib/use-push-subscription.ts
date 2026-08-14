"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Convert a base64url-encoded VAPID public key to a Uint8Array.
 * The Web Push spec requires a BufferSource for applicationServerKey;
 * passing a raw string works in Chrome 67+ but fails in older/non-Chrome engines.
 */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const b64    = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw    = atob(b64);
  const arr    = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

/**
 * Shared Web Push subscription state/actions — used by both the home header
 * (subscribe entry point) and the /webhook page (unsubscribe control).
 */
export function usePushSubscription(enabled: boolean) {
  const [subscribed,   setSubscribed]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [supported,    setSupported]    = useState(false);
  // True when on iOS Safari in browser mode (not installed as PWA)
  const [iosNeedsPWA,  setIosNeedsPWA]  = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    const isStandalone =
      (navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    // On iOS, Web Push only works from an installed PWA (Home Screen icon).
    // Show a hint instead of an unusable button when in browser mode.
    if (isIos && !isStandalone) {
      setIosNeedsPWA(true);
      return;
    }

    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, [enabled]);

  const toggle = useCallback(async () => {
    if (!supported || loading) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      if (subscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setSubscribed(false);
        return;
      }

      // Request permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;

      // Fetch VAPID public key
      const res = await fetch("/api/push/subscribe");
      const { enabled: pushEnabled, publicKey } = await res.json();
      if (!pushEnabled || !publicKey) return;

      // Subscribe — convert to Uint8Array for maximum browser compatibility
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      setSubscribed(true);
    } catch (e) {
      console.error("[push]", e);
    } finally {
      setLoading(false);
    }
  }, [supported, subscribed, loading]);

  return { subscribed, loading, supported, iosNeedsPWA, toggle };
}
