import { NextRequest, NextResponse } from "next/server";
import { getDeadlineRenewals } from "@/lib/items-query";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

type Params = { params: Promise<{ id: string }> };

// GET /api/items/[id]/renewals
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const renewals = await getDeadlineRenewals(Number(id));
  if (renewals === null) return jsonError("Not found", 404);
  return NextResponse.json(renewals);
}
