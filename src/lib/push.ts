import webpush from "web-push";

/** Returns true when VAPID keys are configured in environment. */
export function isPushEnabled(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_EMAIL
  );
}

/** Must be called once before any sendPush() call. Safe to call multiple times. */
export function initWebPush() {
  if (!isPushEnabled()) return;
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh:   string;
  auth:     string;
}

export interface PushPayload {
  title: string;
  body:  string;
  url?:  string;
  tag?:  string;
}

/**
 * Send a push notification to a single subscription.
 * Returns `true` on success, `false` if the subscription is stale (410/404).
 * Re-throws other errors so the caller can decide handling.
 */
export async function sendPush(
  sub: PushSubscriptionKeys,
  payload: PushPayload
): Promise<boolean> {
  initWebPush();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 } // 24 h TTL
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 410 || status === 404) return false; // subscription expired
    throw err;
  }
}

/** The client-facing VAPID public key (safe to expose). */
export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}
