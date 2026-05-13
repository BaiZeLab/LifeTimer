import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getConsumptionItem } from "@/lib/items-query";
import { requireSession, requireItemOwnership } from "@/lib/api-auth";
import type { PatchLogBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

type Params = { params: Promise<{ id: string; logId: string }> };

// PATCH /api/items/[id]/logs/[logId]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  const { id, logId } = await params;
  const numId = Number(id);
  const numLogId = Number(logId);

  const ownershipError = await requireItemOwnership(numId, session.user.id);
  if (ownershipError) return ownershipError;

  const logRows = await sql`
    SELECT id FROM consumption_logs WHERE id = ${numLogId} AND item_id = ${numId}
  ` as { id: number }[];
  if (logRows.length === 0) return jsonError("Not found", 404);

  const body: PatchLogBody = await req.json().catch(() => ({}));

  if (body.isAnomaly !== undefined) {
    await sql`UPDATE consumption_logs SET is_anomaly = ${body.isAnomaly} WHERE id = ${numLogId}`;
  }
  if (body.notes !== undefined) {
    await sql`UPDATE consumption_logs SET notes = ${body.notes} WHERE id = ${numLogId}`;
  }
  if (body.value !== undefined) {
    await sql`UPDATE consumption_logs SET value = ${body.value} WHERE id = ${numLogId}`;
    await sql`UPDATE items SET updated_at = ${new Date().toISOString()} WHERE id = ${numId}`;
  }

  const [updated] = await sql`SELECT * FROM consumption_logs WHERE id = ${numLogId}` as {
    id: number; item_id: number; recorded_at: string; value: number;
    is_topup: boolean; is_anomaly: boolean; notes: string | null;
  }[];

  return NextResponse.json({
    log: {
      id: updated.id, itemId: updated.item_id, recordedAt: updated.recorded_at,
      value: updated.value, isTopup: updated.is_topup, isAnomaly: updated.is_anomaly, notes: updated.notes,
    },
    item: await getConsumptionItem(numId, session.user.id),
  });
}

// DELETE /api/items/[id]/logs/[logId]
export async function DELETE(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  const { id, logId } = await params;
  const numId = Number(id);
  const numLogId = Number(logId);

  const ownershipError = await requireItemOwnership(numId, session.user.id);
  if (ownershipError) return ownershipError;

  const rows = await sql`
    DELETE FROM consumption_logs WHERE id = ${numLogId} AND item_id = ${numId} RETURNING id
  ` as { id: number }[];
  if (rows.length === 0) return jsonError("Not found", 404);

  await sql`UPDATE items SET updated_at = ${new Date().toISOString()} WHERE id = ${numId}`;
  return NextResponse.json({ item: await getConsumptionItem(numId, session.user.id) });
}
