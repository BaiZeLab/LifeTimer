/**
 * GET /api/webhook/log
 *
 * Returns the current user's recent webhook-triggered notifications. This is
 * the same data the /webhook page renders as a readable inbox — it exists
 * regardless of whether the push notification itself was actually delivered.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { listWebhookLog } from "@/lib/webhook";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  const rows = await listWebhookLog(session.user.id);
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      status: r.status,
      delivered: r.delivered,
      createdAt: r.created_at,
    }))
  );
}
