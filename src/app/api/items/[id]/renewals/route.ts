import { NextRequest, NextResponse } from "next/server";
import { getDeadlineRenewals } from "@/lib/items-query";
import { requireSession, requireItemOwnership } from "@/lib/api-auth";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

type Params = { params: Promise<{ id: string }> };

// GET /api/items/[id]/renewals
export async function GET(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  const { id } = await params;
  const numId = Number(id);

  const ownershipError = await requireItemOwnership(numId, session.user.id);
  if (ownershipError) return ownershipError;

  const renewals = await getDeadlineRenewals(numId);
  if (renewals === null) return jsonError("Not found", 404);
  return NextResponse.json(renewals);
}
