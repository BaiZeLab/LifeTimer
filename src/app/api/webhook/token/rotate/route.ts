/**
 * POST /api/webhook/token/rotate
 *
 * Regenerates the current user's webhook token. The old URL stops working
 * immediately — any third-party integration using it must be updated.
 * Returns only the new token; the frontend rebuilds the full URL using
 * `window.location.origin` (see /api/webhook/token for why).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { rotateWebhookToken } from "@/lib/webhook";

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  const row = await rotateWebhookToken(session.user.id);

  return NextResponse.json({ token: row.token });
}
