import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getConsumptionItem } from "@/lib/items-query";
import type { PatchLogBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

type Params = { params: Promise<{ id: string; logId: string }> };

// PATCH /api/items/[id]/logs/[logId]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, logId } = await params;
  const numId = Number(id);
  const numLogId = Number(logId);

  const log = db
    .prepare("SELECT * FROM consumption_logs WHERE id = ? AND item_id = ?")
    .get(numLogId, numId);
  if (!log) return jsonError("Not found", 404);

  const body: PatchLogBody = await req.json().catch(() => ({}));

  if (body.isAnomaly !== undefined) {
    db.prepare("UPDATE consumption_logs SET is_anomaly = ? WHERE id = ?")
      .run(body.isAnomaly ? 1 : 0, numLogId);
  }
  if (body.notes !== undefined) {
    db.prepare("UPDATE consumption_logs SET notes = ? WHERE id = ?")
      .run(body.notes, numLogId);
  }
  if (body.value !== undefined) {
    db.prepare("UPDATE consumption_logs SET value = ? WHERE id = ?")
      .run(body.value, numLogId);
    db.prepare("UPDATE items SET updated_at = datetime('now') WHERE id = ?").run(numId);
  }

  const updated = db.prepare("SELECT * FROM consumption_logs WHERE id = ?").get(numLogId) as {
    id: number; item_id: number; recorded_at: string; value: number;
    is_topup: number; is_anomaly: number; notes: string | null;
  };

  return NextResponse.json({
    log: {
      id: updated.id, itemId: updated.item_id, recordedAt: updated.recorded_at,
      value: updated.value, isTopup: !!updated.is_topup, isAnomaly: !!updated.is_anomaly, notes: updated.notes,
    },
    item: getConsumptionItem(numId),
  });
}

// DELETE /api/items/[id]/logs/[logId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, logId } = await params;
  const result = db
    .prepare("DELETE FROM consumption_logs WHERE id = ? AND item_id = ?")
    .run(Number(logId), Number(id));
  if (result.changes === 0) return jsonError("Not found", 404);

  db.prepare("UPDATE items SET updated_at = datetime('now') WHERE id = ?").run(Number(id));
  return NextResponse.json({ item: getConsumptionItem(Number(id)) });
}
