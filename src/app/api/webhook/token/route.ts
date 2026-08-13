/**
 * GET /api/webhook/token
 *
 * Returns the current user's webhook URL, creating a token on first access.
 * The token is the sole credential for /api/webhook/push/[token] — by design
 * there is no additional authentication on the receive endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getOrCreateWebhookToken } from "@/lib/webhook";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  const row = await getOrCreateWebhookToken(session.user.id);
  const origin = req.nextUrl.origin;

  return NextResponse.json({
    url: `${origin}/api/webhook/push/${row.token}`,
    createdAt: row.created_at,
    rotatedAt: row.rotated_at,
    lastUsedAt: row.last_used_at,
  });
}
