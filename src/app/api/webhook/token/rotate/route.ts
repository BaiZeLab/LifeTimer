/**
 * POST /api/webhook/token/rotate
 *
 * Regenerates the current user's webhook token. The old URL stops working
 * immediately — any third-party integration using it must be updated.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { rotateWebhookToken } from "@/lib/webhook";

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  const row = await rotateWebhookToken(session.user.id);
  const origin = req.nextUrl.origin;

  return NextResponse.json({ url: `${origin}/api/webhook/push/${row.token}` });
}
