import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { syncItemTags } from "@/lib/tags";
import { getItem } from "@/lib/items-query";
import type { PatchItemBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

type Params = { params: Promise<{ id: string }> };

// GET /api/items/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const item = getItem(Number(id));
  if (!item) return jsonError("Not found", 404);
  return NextResponse.json(item);
}

// PATCH /api/items/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = Number(id);
  const body: PatchItemBody = await req.json().catch(() => ({}));

  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(numId) as
    | { id: number; type: string; archived_at: string | null }
    | undefined;
  if (!existing) return jsonError("Not found", 404);

  const update = db.transaction(() => {
    if (body.name !== undefined) {
      db.prepare("UPDATE items SET name = ?, updated_at = datetime('now') WHERE id = ?")
        .run(body.name.trim(), numId);
    }
    if (body.notes !== undefined) {
      db.prepare("UPDATE items SET notes = ?, updated_at = datetime('now') WHERE id = ?")
        .run(body.notes, numId);
    }
    if (body.tags !== undefined) {
      syncItemTags(numId, body.tags);
    }
    if (body.alertDays !== undefined) {
      const table = existing.type === "deadline" ? "deadline_items" : "consumption_items";
      db.prepare(`UPDATE ${table} SET alert_days = ? WHERE item_id = ?`)
        .run(body.alertDays, numId);
    }
    if (existing.type === "deadline" && body.startDate !== undefined) {
      db.prepare("UPDATE deadline_items SET start_date = ? WHERE item_id = ?")
        .run(body.startDate, numId);
    }
    if (body.archived !== undefined) {
      const val = body.archived ? new Date().toISOString() : null;
      db.prepare("UPDATE items SET archived_at = ?, updated_at = datetime('now') WHERE id = ?")
        .run(val, numId);
    }
  });

  update();
  return NextResponse.json(getItem(numId));
}

// DELETE /api/items/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = Number(id);
  const result = db.prepare("DELETE FROM items WHERE id = ?").run(numId);
  if (result.changes === 0) return jsonError("Not found", 404);
  return new NextResponse(null, { status: 204 });
}
