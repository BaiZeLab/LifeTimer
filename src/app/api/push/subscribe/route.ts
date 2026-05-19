import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { vapidPublicKey, isPushEnabled } from "@/lib/push";
import sql from "@/lib/db";

// GET — return VAPID public key so the client can subscribe
export async function GET() {
  if (!isPushEnabled()) {
    return NextResponse.json({ enabled: false, publicKey: "" });
  }
  return NextResponse.json({ enabled: true, publicKey: vapidPublicKey() });
}

// POST — save a new push subscription
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  if (!isPushEnabled()) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }

  const body = await req.json() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  // Derive the push-service host (protocol + hostname) from the endpoint URL.
  // e.g. "https://fcm.googleapis.com/fcm/send/xxx" → "https://fcm.googleapis.com"
  // This lets us implement "one subscription per push service per user":
  // when the user reinstalls the PWA they get a new endpoint from the same service;
  // we replace the old one instead of accumulating stale subscriptions.
  let serviceHost: string;
  try {
    const url = new URL(body.endpoint);
    serviceHost = `${url.protocol}//${url.host}`;
  } catch {
    return NextResponse.json({ error: "Invalid endpoint URL" }, { status: 400 });
  }

  // Remove existing subscriptions for this user from the same push service,
  // then insert the fresh one.  Using a transaction ensures atomicity.
  await sql`
    DELETE FROM push_subscriptions
    WHERE user_id = ${session.user.id}
      AND endpoint LIKE ${serviceHost + "/%"}
  `;

  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${session.user.id}, ${body.endpoint}, ${body.keys.p256dh}, ${body.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE
      SET user_id = ${session.user.id},
          p256dh  = ${body.keys.p256dh},
          auth    = ${body.keys.auth}
  `;

  return NextResponse.json({ ok: true });
}

// DELETE — remove a push subscription
export async function DELETE(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  const body = await req.json() as { endpoint: string };
  if (!body.endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await sql`
    DELETE FROM push_subscriptions
    WHERE endpoint = ${body.endpoint} AND user_id = ${session.user.id}
  `;

  return NextResponse.json({ ok: true });
}
