import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getConsumptionLogs, getConsumptionItem } from "@/lib/items-query";
import type { CreateLogBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

type Params = { params: Promise<{ id: string }> };

// GET /api/items/[id]/logs
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = Number(id);
  const cons = db.prepare("SELECT item_id FROM consumption_items WHERE item_id = ?").get(numId);
  if (!cons) return jsonError("Not found or not a consumption item", 404);
  return NextResponse.json(getConsumptionLogs(numId));
}

// POST /api/items/[id]/logs
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = Number(id);

  const cons = db.prepare("SELECT item_id FROM consumption_items WHERE item_id = ?").get(numId);
  if (!cons) return jsonError("Not found or not a consumption item", 404);

  const body: CreateLogBody = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON", 400);
  if (body.value === undefined || body.value === null) return jsonError("value is required", 400);
  if (!body.recordedAt) return jsonError("recordedAt is required", 400);

  // Determine if this is a topup (new value > most recent value)
  const prev = db
    .prepare("SELECT value FROM consumption_logs WHERE item_id = ? ORDER BY recorded_at DESC LIMIT 1")
    .get(numId) as { value: number } | undefined;
  const isTopup = prev ? body.value > prev.value : false;

  const result = db
    .prepare(
      `INSERT INTO consumption_logs (item_id, recorded_at, value, is_topup, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(numId, body.recordedAt, body.value, isTopup ? 1 : 0, body.notes ?? null);

  db.prepare("UPDATE items SET updated_at = datetime('now') WHERE id = ?").run(numId);

  const logId = result.lastInsertRowid as number;
  const log = db.prepare("SELECT * FROM consumption_logs WHERE id = ?").get(logId) as {
    id: number; item_id: number; recorded_at: string; value: number;
    is_topup: number; is_anomaly: number; notes: string | null;
  };

  return NextResponse.json({
    log: {
      id: log.id, itemId: log.item_id, recordedAt: log.recorded_at,
      value: log.value, isTopup: !!log.is_topup, isAnomaly: !!log.is_anomaly, notes: log.notes,
    },
    item: getConsumptionItem(numId),
  }, { status: 201 });
}
