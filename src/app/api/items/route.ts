import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { syncItemTags } from "@/lib/tags";
import { getDeadlineItems, getConsumptionItems } from "@/lib/items-query";
import type { CreateItemBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

// GET /api/items?type=deadline|consumption&archived=false
export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const archivedOnly = searchParams.get("archived") === "true";

  if (type === "deadline") {
    return NextResponse.json(getDeadlineItems(archivedOnly));
  }
  if (type === "consumption") {
    return NextResponse.json(getConsumptionItems(archivedOnly));
  }
  // Both
  return NextResponse.json({
    deadline: getDeadlineItems(archivedOnly),
    consumption: getConsumptionItems(archivedOnly),
  });
}

// POST /api/items
export async function POST(req: NextRequest) {
  const body: CreateItemBody = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON", 400);
  if (!body.name?.trim()) return jsonError("name is required", 400);
  if (!body.type) return jsonError("type is required", 400);

  const insert = db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO items (name, type, notes) VALUES (?, ?, ?)"
      )
      .run(body.name.trim(), body.type, body.notes ?? null);
    const itemId = result.lastInsertRowid as number;

    if (body.type === "deadline") {
      if (!body.expireDate) throw new Error("expireDate is required");
      // Default start_date to today (录入日) when not explicitly provided
      const startDate = body.startDate ?? new Date().toISOString().slice(0, 10);
      db.prepare(
        "INSERT INTO deadline_items (item_id, expire_date, start_date, alert_days) VALUES (?, ?, ?, ?)"
      ).run(itemId, body.expireDate, startDate, body.alertDays ?? 30);
    } else {
      if (!body.unit?.trim()) throw new Error("unit is required");
      db.prepare(
        "INSERT INTO consumption_items (item_id, unit, alert_days) VALUES (?, ?, ?)"
      ).run(itemId, body.unit.trim(), body.alertDays ?? 7);
    }

    if (body.tags?.length) syncItemTags(itemId, body.tags);

    return itemId;
  });

  try {
    const itemId = insert() as number;
    const { getItem } = await import("@/lib/items-query");
    return NextResponse.json(getItem(itemId), { status: 201 });
  } catch (e) {
    return jsonError((e as Error).message, 400);
  }
}
