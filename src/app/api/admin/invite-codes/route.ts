import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { headers } from "next/headers";
import { randomBytes } from "crypto";

function requireAdmin(role: string | null | undefined) {
  return role === "admin";
}

// GET /api/admin/invite-codes
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !requireAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const codes = await sql`
    SELECT ic.code, ic.created_at, ic.expires_at, ic.used_at,
           u.email AS used_by_email
    FROM invite_codes ic
    LEFT JOIN "user" u ON u.id = ic.used_by
    ORDER BY ic.created_at DESC
  `;
  return NextResponse.json(codes);
}

// POST /api/admin/invite-codes  – create a new invite code
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !requireAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { expiresInDays?: number };
  const code = randomBytes(6).toString("hex").toUpperCase(); // 12-char hex code

  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 86_400_000).toISOString()
    : null;

  await sql`
    INSERT INTO invite_codes (code, created_by, expires_at)
    VALUES (${code}, ${session.user.id}, ${expiresAt})
  `;

  return NextResponse.json({ code }, { status: 201 });
}

// DELETE /api/admin/invite-codes?code=XXX  – revoke an unused invite code
export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !requireAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  await sql`DELETE FROM invite_codes WHERE code = ${code} AND used_by IS NULL`;
  return new NextResponse(null, { status: 204 });
}
