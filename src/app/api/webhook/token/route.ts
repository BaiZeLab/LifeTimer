/**
 * GET /api/webhook/token
 *
 * Returns the current user's webhook token, creating one on first access.
 * The token is the sole credential for /api/webhook/push/[token] — by design
 * there is no additional authentication on the receive endpoint.
 *
 * Only the token is returned, not a full URL: the server-derived origin can
 * be wrong behind a reverse proxy / CDN (wrong scheme or internal hostname).
 * The frontend builds the full URL from `window.location.origin`, which is
 * always exactly what the user is browsing, and appends the fixed
 * `/api/webhook/push/` path itself.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getOrCreateWebhookToken } from "@/lib/webhook";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  const row = await getOrCreateWebhookToken(session.user.id);

  return NextResponse.json({
    token: row.token,
    createdAt: row.created_at,
    rotatedAt: row.rotated_at,
    lastUsedAt: row.last_used_at,
  });
}
