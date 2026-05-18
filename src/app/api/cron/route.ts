/**
 * /api/cron — called by start.js on a 1-hour schedule.
 *
 * For every user with active push subscriptions:
 *   1. Fetch their non-archived deadline + consumption items.
 *   2. Filter items in warning / danger / expired status.
 *   3. Skip items already pushed in the last 20 hours (dedup via push_log).
 *   4. Send a push notification per item.
 *   5. Record sent items in push_log; prune entries older than 48 h.
 *
 * Auth: accepts a CRON_SECRET header for external callers, or allows
 * unauthenticated access from localhost (Docker-internal call from start.js).
 */

import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { sendPush, isPushEnabled, initWebPush } from "@/lib/push";
import { getDeadlineItems, getConsumptionItems } from "@/lib/items-query";

const DEDUP_HOURS = 20;

export async function GET(req: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!isPushEnabled()) {
    return NextResponse.json({ skipped: "push not configured" });
  }

  initWebPush();

  // ── Fetch all users with at least one subscription ─────────────────────
  const usersWithSubs = await sql`
    SELECT DISTINCT user_id FROM push_subscriptions
  ` as { user_id: string }[];

  // ── Prune push_log older than 48 h (housekeeping) ──────────────────────
  await sql`DELETE FROM push_log WHERE sent_at < NOW() - INTERVAL '48 hours'`;

  let totalSent = 0;
  let totalSkipped = 0;
  let staleRemoved = 0;

  for (const { user_id } of usersWithSubs) {
    // Get this user's subscriptions
    const subs = await sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${user_id}
    ` as { endpoint: string; p256dh: string; auth: string }[];

    if (subs.length === 0) continue;

    // Get recently-alerted item IDs for this user
    const recentRows = await sql`
      SELECT item_id FROM push_log
      WHERE user_id = ${user_id}
        AND sent_at > NOW() - INTERVAL '${DEDUP_HOURS} hours'
    ` as { item_id: number }[];
    const recentIds = new Set(recentRows.map((r) => r.item_id));

    // Fetch all items for this user
    const [deadlines, consumptions] = await Promise.all([
      getDeadlineItems(user_id),
      getConsumptionItems(user_id),
    ]);

    // Collect alert-worthy items
    const toAlert: { id: number; name: string; msg: string; url: string }[] = [];

    for (const item of deadlines) {
      if (item.status === "ok") continue;
      if (recentIds.has(item.id)) { totalSkipped++; continue; }
      const label =
        item.status === "expired"  ? `已过期 ${Math.abs(item.daysLeft)} 天` :
        item.status === "danger"   ? `仅剩 ${item.daysLeft} 天` :
                                     `还有 ${item.daysLeft} 天到期`;
      toAlert.push({
        id:   item.id,
        name: item.name,
        msg:  `${item.name} — ${label}`,
        url:  "/",
      });
    }

    for (const item of consumptions) {
      if (item.status === "ok" || item.logCount < 2) continue;
      if (recentIds.has(item.id)) { totalSkipped++; continue; }
      const label =
        item.status === "expired"  ? "估算已耗尽" :
        item.status === "danger"   ? `预计还剩 ${item.estimatedDays} 天` :
                                     `约 ${item.estimatedDays} 天后耗尽`;
      toAlert.push({
        id:   item.id,
        name: item.name,
        msg:  `${item.name} (${item.unit}) — ${label}`,
        url:  "/",
      });
    }

    if (toAlert.length === 0) continue;

    // Build notification body
    const body =
      toAlert.length === 1
        ? toAlert[0].msg
        : `${toAlert.length} 项需要关注：${toAlert.map((i) => i.name).join("、")}`;

    const payload = {
      title: "Life Timer 提醒",
      body,
      url: "/",
      tag: "lt-cron-alert",
    };

    // Send to each subscription, remove stale ones
    for (const sub of subs) {
      const ok = await sendPush(sub, payload);
      if (ok) {
        totalSent++;
      } else {
        // Stale subscription — remove it
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
        staleRemoved++;
      }
    }

    // Record sent in push_log
    if (toAlert.length > 0) {
      for (const item of toAlert) {
        await sql`
          INSERT INTO push_log (user_id, item_id) VALUES (${user_id}, ${item.id})
        `;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    usersProcessed: usersWithSubs.length,
    notificationsSent: totalSent,
    itemsSkipped: totalSkipped,
    staleSubscriptionsRemoved: staleRemoved,
    timestamp: new Date().toISOString(),
  });
}
