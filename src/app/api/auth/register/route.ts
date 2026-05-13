import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";

// POST /api/auth/register  – invite-code–gated sign-up
// This is the only public registration path; direct calls to
// /api/auth/sign-up/email are blocked by middleware.
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string; inviteCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password, name, inviteCode } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password and name are required" }, { status: 400 });
  }
  if (!inviteCode) {
    return NextResponse.json({ error: "邀请码不能为空" }, { status: 400 });
  }

  // Validate invite code
  const codes = await sql`
    SELECT code FROM invite_codes
    WHERE code = ${inviteCode}
      AND used_by IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  ` as { code: string }[];

  if (codes.length === 0) {
    return NextResponse.json({ error: "邀请码无效或已使用" }, { status: 400 });
  }

  // Create user via better-auth and get the full Response (with set-cookie)
  const response = await auth.api.signUpEmail({
    body: { email, password, name },
    asResponse: true,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "注册失败" }));
    return NextResponse.json(err, { status: response.status });
  }

  // Mark the invite code as used
  const data = await response.clone().json() as { user?: { id: string } };
  const userId = data?.user?.id;
  if (userId) {
    await sql`
      UPDATE invite_codes
      SET used_by = ${userId}, used_at = NOW()
      WHERE code = ${inviteCode}
    `;
  }

  return response;
}
