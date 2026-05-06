import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
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
  const rows = await sql`SELECT item_id FROM consumption_items WHERE item_id = ${numId}`;
  if (rows.length === 0) return jsonError("Not found or not a consumption item", 404);
  return NextResponse.json(await getConsumptionLogs(numId));
}

// POST /api/items/[id]/logs
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = Number(id);

  const consRows = await sql`SELECT item_id FROM consumption_items WHERE item_id = ${numId}`;
  if (consRows.length === 0) return jsonError("Not found or not a consumption item", 404);

  const body: CreateLogBody = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON", 400);
  if (body.value === undefined || body.value === null) return jsonError("value is required", 400);
  if (!body.recordedAt) return jsonError("recordedAt is required", 400);

  const prevRows = await sql`
    SELECT value FROM consumption_logs WHERE item_id = ${numId} ORDER BY recorded_at DESC LIMIT 1
  ` as { value: number }[];
  const isTopup = prevRows[0] ? body.value > prevRows[0].value : false;

  const [log] = await sql`
    INSERT INTO consumption_logs (item_id, recorded_at, value, is_topup, notes)
    VALUES (${numId}, ${body.recordedAt}, ${body.value}, ${isTopup}, ${body.notes ?? null})
    RETURNING *
  ` as {
    id: number; item_id: number; recorded_at: string; value: number;
    is_topup: boolean; is_anomaly: boolean; notes: string | null;
  }[];

  await sql`UPDATE items SET updated_at = ${new Date().toISOString()} WHERE id = ${numId}`;

  return NextResponse.json({
    log: {
      id: log.id, itemId: log.item_id, recordedAt: log.recorded_at,
      value: log.value, isTopup: log.is_topup, isAnomaly: log.is_anomaly, notes: log.notes,
    },
    item: await getConsumptionItem(numId),
  }, { status: 201 });
}
