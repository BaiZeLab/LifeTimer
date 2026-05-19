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

  // Upsert first, then cap.
  //
  // Order matters: if the same endpoint re-subscribes we want ON CONFLICT to
  // update in-place (count stays the same), not trigger an extra delete first
  // which would drop a legitimate subscription from another device.
  //
  // Cap rationale: prevents unlimited accumulation when users repeatedly
  // reinstall the PWA.  We keep the newest MAX_SUBS entries; stale ones from
  // deleted PWAs get cleaned up naturally when the cron send attempt returns
  // 404/410.  We do NOT scope the cap by push-service host because iPhone and
  // Mac Safari both use web.push.apple.com — that would make them stomp on
  // each other's subscription.
  const MAX_SUBS = 5;

  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${session.user.id}, ${body.endpoint}, ${body.keys.p256dh}, ${body.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE
      SET user_id = ${session.user.id},
          p256dh  = ${body.keys.p256dh},
          auth    = ${body.keys.auth}
  `;

  // After upsert, trim any excess beyond the cap (keeps newest MAX_SUBS rows)
  await sql`
    DELETE FROM push_subscriptions
    WHERE user_id = ${session.user.id}
      AND id IN (
        SELECT id FROM push_subscriptions
        WHERE user_id = ${session.user.id}
        ORDER BY created_at DESC
        OFFSET ${MAX_SUBS}
      )
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
