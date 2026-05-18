/**
 * POST /api/admin/push
 *
 * Admin-only endpoint to broadcast a custom push notification.
 *
 * Body:
 *   { title: string, body: string, url?: string, userIds?: string[] }
 *
 * If userIds is omitted or empty → sends to ALL users with subscriptions.
 * Returns: { sent, failed, staleRemoved }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { headers } from "next/headers";
import sql from "@/lib/db";
import { sendPush, isPushEnabled, initWebPush } from "@/lib/push";

function requireAdmin(role: string | null | undefined) {
  return role === "admin";
}

export async function POST(req: NextRequest) {
  // ── Admin auth ──────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !requireAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isPushEnabled()) {
    return NextResponse.json({ error: "Push notifications are not configured" }, { status: 503 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  const body = await req.json() as {
    title?: string;
    body?: string;
    url?: string;
    userIds?: string[];
  };

  const title = body.title?.trim();
  const text  = body.body?.trim();
  if (!title || !text) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  initWebPush();

  // ── Fetch subscriptions ─────────────────────────────────────────────────
  const subs = body.userIds?.length
    ? await sql`
        SELECT endpoint, p256dh, auth, user_id
        FROM push_subscriptions
        WHERE user_id = ANY(${body.userIds})
      ` as { endpoint: string; p256dh: string; auth: string; user_id: string }[]
    : await sql`
        SELECT endpoint, p256dh, auth, user_id FROM push_subscriptions
      ` as { endpoint: string; p256dh: string; auth: string; user_id: string }[];

  if (subs.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, staleRemoved: 0, message: "No subscriptions found" });
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  const payload = {
    title,
    body:  text,
    url:   body.url ?? "/",
    tag:   "lt-admin-broadcast",
  };

  let sent = 0, failed = 0, staleRemoved = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const ok = await sendPush(sub, payload);
        if (ok) {
          sent++;
        } else {
          // Stale subscription (410 / 404 from push service)
          await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
          staleRemoved++;
        }
      } catch {
        failed++;
      }
    })
  );

  return NextResponse.json({
    sent,
    failed,
    staleRemoved,
    total: subs.length,
  });
}

// GET /api/admin/push — return subscription stats per user
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !requireAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await sql`
    SELECT ps.user_id, u.name, u.email, COUNT(*) AS sub_count
    FROM push_subscriptions ps
    JOIN "user" u ON u.id = ps.user_id
    GROUP BY ps.user_id, u.name, u.email
    ORDER BY u.name
  ` as { user_id: string; name: string; email: string; sub_count: string }[];

  return NextResponse.json(
    rows.map((r) => ({ ...r, sub_count: Number(r.sub_count) }))
  );
}
