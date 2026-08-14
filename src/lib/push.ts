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
  const email = process.env.VAPID_EMAIL!;
  // Accept either "mailto:user@example.com" or bare "user@example.com"
  const subject = email.startsWith("mailto:") || email.startsWith("https://")
    ? email
    : `mailto:${email}`;
  webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
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

// A single unreachable push service (e.g. a long-dead endpoint) must not be
// able to hang the whole request — cap each send so callers always get a
// timely response regardless of how many subscriptions a user has.
const SEND_TIMEOUT_MS = 10_000;

/**
 * Send a push notification to a single subscription.
 * Returns `true` on success, `false` if the subscription is stale (410/404).
 * Re-throws other errors — including a socket timeout — so the caller skips
 * the device without deleting its (possibly still-valid) subscription.
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
      { TTL: 60 * 60 * 24, timeout: SEND_TIMEOUT_MS } // 24 h TTL
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
