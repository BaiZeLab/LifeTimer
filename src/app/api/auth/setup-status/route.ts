import { NextResponse } from "next/server";
import { isInitialized } from "@/lib/setup";

// GET /api/auth/setup-status
// Public endpoint — returns whether the system has been initialized (first admin created).
export async function GET() {
  const initialized = await isInitialized();
  return NextResponse.json({ initialized });
}
