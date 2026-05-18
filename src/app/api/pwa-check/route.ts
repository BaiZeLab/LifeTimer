import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { headers as nextHeaders } from "next/headers";
import sql from "@/lib/db";

// ── POST /api/pwa-check ───────────────────────────────────────────────────────
// Public endpoint — no session required so that unauthenticated users on the
// /pwa-check diagnostic page can still submit their report.
// We do minimal sanitisation and simply log to the DB.

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Extract fields with safe casts
  const str  = (k: string) => (typeof body[k] === "string" ? String(body[k]).slice(0, 2000) : null);
  const bool = (k: string) => (typeof body[k] === "boolean" ? body[k] as boolean : null);

  await sql`
    INSERT INTO pwa_diagnostics (
      user_agent, is_ios, ios_version, is_android, is_standalone, is_https,
      sw_supported, sw_registered,
      notif_supported, notif_perm, push_supported,
      manifest_ok, manifest_mime,
      icon192_ok,
      apple_icon_ok, apple_icon_mime, apple_icon_url,
      raw_data
    ) VALUES (
      ${str("userAgent")},
      ${bool("isIos")},
      ${str("iosVersion")},
      ${bool("isAndroid")},
      ${bool("isStandalone")},
      ${bool("isHttps")},
      ${bool("swSupported")},
      ${bool("swRegistered")},
      ${bool("notifSupported")},
      ${str("notifPerm")},
      ${bool("pushSupported")},
      ${bool("manifestOk")},
      ${str("manifestMime")},
      ${bool("icon192Ok")},
      ${bool("appleIconOk")},
      ${str("appleIconMime")},
      ${str("appleIconUrl")},
      ${JSON.stringify(body)}
    )
  `;

  return NextResponse.json({ ok: true });
}

// ── GET /api/pwa-check ────────────────────────────────────────────────────────
// Admin-only: returns the 50 most recent diagnostic reports.

export async function GET() {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await sql`
    SELECT
      id, user_agent, is_ios, ios_version, is_android, is_standalone, is_https,
      sw_supported, sw_registered,
      notif_supported, notif_perm, push_supported,
      manifest_ok, manifest_mime,
      icon192_ok,
      apple_icon_ok, apple_icon_mime, apple_icon_url,
      submitted_at
    FROM pwa_diagnostics
    ORDER BY submitted_at DESC
    LIMIT 50
  `;

  return NextResponse.json({ rows });
}
