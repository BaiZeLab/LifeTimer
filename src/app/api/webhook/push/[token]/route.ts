/**
 * GET|POST /api/webhook/push/[token]
 *
 * Public endpoint — no session, no signature, no extra headers. The token in
 * the URL path is the only credential, by design (see product spec). Anyone
 * holding the token can trigger a push to that user's devices; regenerating
 * the token (on the /webhook page) invalidates the old URL immediately.
 *
 * Accepts either:
 *   - POST with a JSON body: { "title"?: string, "body": string }
 *   - POST with a plain-text body (no title, the whole text becomes body)
 *   - GET with query params: ?title=&body=
 * A few common field-name aliases are accepted for compatibility with simple
 * webhook senders: body/text/message/content, title/subject.
 *
 * Every call is recorded in webhook_log — even when no device is subscribed
 * — so the /webhook page always shows the message and lets the user copy it,
 * independent of whether the push itself was delivered.
 */

import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { sendPush, isPushEnabled, initWebPush } from "@/lib/push";
import {
  findUserIdByToken,
  touchWebhookToken,
  isRateLimited,
  insertWebhookLog,
  updateWebhookLogResult,
  extractPayload,
} from "@/lib/webhook";

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIp || null;
}

async function handle(req: NextRequest, token: string): Promise<NextResponse> {
  const userId = await findUserIdByToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (await isRateLimited(userId)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // ── Parse payload from whichever shape the caller sent ─────────────────
  let title: string;
  let body: string | null;

  if (req.method === "GET") {
    const params: Record<string, unknown> = {};
    req.nextUrl.searchParams.forEach((v, k) => (params[k] = v));
    ({ title, body } = extractPayload(params));
  } else {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      let json: Record<string, unknown> = {};
      try {
        json = await req.json();
      } catch {
        json = {};
      }
      ({ title, body } = extractPayload(json));
    } else {
      // Plain text / form / unknown — treat the whole raw body as the message.
      const text = (await req.text()).trim();
      ({ title, body } = extractPayload({ body: text }));
    }
  }

  if (!body) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  await touchWebhookToken(token);
  const logId = await insertWebhookLog({ userId, ip: clientIp(req), title, body });

  // ── Deliver to every subscribed device ──────────────────────────────────
  let delivered = 0;
  if (isPushEnabled()) {
    initWebPush();
    const subs = await sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
    ` as { endpoint: string; p256dh: string; auth: string }[];

    const payload = {
      title,
      body,
      url: `/webhook?highlight=${logId}`,
      tag: `lt-webhook-${logId}`,
    };

    // Send to every device in parallel — a single slow/unreachable endpoint
    // (bounded by sendPush's own timeout) must not delay delivery to the
    // rest, nor stall the response back to the webhook caller.
    const results = await Promise.allSettled(subs.map((sub) => sendPush(sub, payload)));
    const staleEndpoints: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        if (result.value) {
          delivered++;
        } else {
          staleEndpoints.push(subs[i].endpoint);
        }
      }
      // rejected (non-stale error, e.g. timeout) — skip this device, keep going.
    });
    if (staleEndpoints.length) {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ANY(${staleEndpoints})`;
    }
  }

  await updateWebhookLogResult(logId, {
    status: delivered > 0 ? "sent" : "undelivered",
    delivered,
  });

  return NextResponse.json({ ok: true, delivered });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handle(req, token);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handle(req, token);
}
