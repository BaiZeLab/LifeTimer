import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isInitialized } from "@/lib/setup";
import sql from "@/lib/db";

// POST /api/auth/setup — one-time admin initialization
//
// Security model:
//   - Checks isInitialized() before creation → rejects if already set up (409)
//   - better-auth's signUpEmail enforces email UNIQUE at DB level → race-condition safe
//   - After creation, upgrades the user to role=admin via direct SQL update
export async function POST(req: NextRequest) {
  // Guard: reject if already initialized
  if (await isInitialized()) {
    return NextResponse.json(
      { error: "系统已初始化，请直接登录" },
      { status: 409 }
    );
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password, name } = body;
  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "email、password 和 name 均不能为空" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 });
  }

  // Create user via better-auth (returns Response with set-cookie)
  const response = await auth.api.signUpEmail({
    body: { email, password, name },
    asResponse: true,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "注册失败" }));
    return NextResponse.json(err, { status: response.status });
  }

  // Upgrade to admin — better-auth creates users as role='user' by default
  await sql`
    UPDATE "user" SET role = 'admin'
    WHERE email = ${email}
  `;

  // Return the original response (contains set-cookie for auto-login)
  return response;
}
