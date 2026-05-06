import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { syncItemTags } from "@/lib/tags";
import { getDeadlineItems, getConsumptionItems, getItem } from "@/lib/items-query";
import type { CreateItemBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

// GET /api/items?type=deadline|consumption&archived=false
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const archivedOnly = searchParams.get("archived") === "true";

  if (type === "deadline") {
    return NextResponse.json(await getDeadlineItems(archivedOnly));
  }
  if (type === "consumption") {
    return NextResponse.json(await getConsumptionItems(archivedOnly));
  }
  const [deadline, consumption] = await Promise.all([
    getDeadlineItems(archivedOnly),
    getConsumptionItems(archivedOnly),
  ]);
  return NextResponse.json({ deadline, consumption });
}

// POST /api/items
export async function POST(req: NextRequest) {
  const body: CreateItemBody = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON", 400);
  if (!body.name?.trim()) return jsonError("name is required", 400);
  if (!body.type) return jsonError("type is required", 400);

  try {
    let itemId: number;

    if (body.type === "deadline") {
      if (!body.expireDate) return jsonError("expireDate is required", 400);
      const startDate = body.startDate ?? new Date().toISOString().slice(0, 10);
      const alertDays = body.alertDays ?? 30;
      const [{ id }] = await sql`
        WITH new_item AS (
          INSERT INTO items (name, type, notes)
          VALUES (${body.name.trim()}, 'deadline', ${body.notes ?? null})
          RETURNING id
        ),
        _detail AS (
          INSERT INTO deadline_items (item_id, expire_date, start_date, alert_days)
          SELECT id, ${body.expireDate}, ${startDate}, ${alertDays} FROM new_item
        )
        SELECT id FROM new_item
      ` as { id: number }[];
      itemId = id;
    } else {
      if (!body.unit?.trim()) return jsonError("unit is required", 400);
      const alertDays = body.alertDays ?? 7;
      const [{ id }] = await sql`
        WITH new_item AS (
          INSERT INTO items (name, type, notes)
          VALUES (${body.name.trim()}, 'consumption', ${body.notes ?? null})
          RETURNING id
        ),
        _detail AS (
          INSERT INTO consumption_items (item_id, unit, alert_days)
          SELECT id, ${body.unit.trim()}, ${alertDays} FROM new_item
        )
        SELECT id FROM new_item
      ` as { id: number }[];
      itemId = id;
    }

    if (body.tags?.length) await syncItemTags(itemId, body.tags);

    return NextResponse.json(await getItem(itemId), { status: 201 });
  } catch (e) {
    return jsonError((e as Error).message, 400);
  }
}
