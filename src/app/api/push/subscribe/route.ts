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

  // Cap at MAX_SUBS per user to prevent unlimited accumulation from repeated
  // PWA reinstalls.  We keep the newest subscriptions (by created_at DESC) so
  // that fresh device installs are always retained.  Stale subscriptions from
  // deleted PWAs are cleaned up naturally by the cron job when a send attempt
  // returns 404/410.
  //
  // We intentionally do NOT scope cleanup by push-service host because
  // iPhone and Mac Safari both use web.push.apple.com — deleting by host would
  // remove one device's subscription when the other device re-subscribes.
  const MAX_SUBS = 5;

  await sql`
    DELETE FROM push_subscriptions
    WHERE user_id = ${session.user.id}
      AND id IN (
        SELECT id FROM push_subscriptions
        WHERE user_id = ${session.user.id}
        ORDER BY created_at DESC
        OFFSET ${MAX_SUBS - 1}
      )
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
