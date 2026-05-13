import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getItemOwner } from "./items-query";

export type AuthedSession = {
  user: { id: string; role: string; name: string; email: string };
};

/** Extract and validate the session from a request. Returns 401 response if not authenticated. */
export async function requireSession(req: NextRequest): Promise<
  { session: AuthedSession; error: null } | { session: null; error: NextResponse }
> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session: session as AuthedSession, error: null };
}

/** Verify the session user owns the item. Returns 403 if not. */
export async function requireItemOwnership(
  itemId: number,
  userId: string
): Promise<NextResponse | null> {
  const ownerId = await getItemOwner(itemId);
  if (!ownerId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ownerId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
