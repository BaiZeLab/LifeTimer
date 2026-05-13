import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { syncItemTags } from "@/lib/tags";
import { getItem } from "@/lib/items-query";
import { requireSession, requireItemOwnership } from "@/lib/api-auth";
import type { PatchItemBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

type Params = { params: Promise<{ id: string }> };

// GET /api/items/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  const { id } = await params;
  const numId = Number(id);

  const ownershipError = await requireItemOwnership(numId, session.user.id);
  if (ownershipError) return ownershipError;

  const item = await getItem(numId, session.user.id);
  if (!item) return jsonError("Not found", 404);
  return NextResponse.json(item);
}

// PATCH /api/items/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  const { id } = await params;
  const numId = Number(id);

  const ownershipError = await requireItemOwnership(numId, session.user.id);
  if (ownershipError) return ownershipError;

  const body: PatchItemBody = await req.json().catch(() => ({}));

  const existing = (await sql`SELECT id, type, archived_at FROM items WHERE id = ${numId}` as {
    id: number; type: string; archived_at: string | null;
  }[])[0];
  if (!existing) return jsonError("Not found", 404);

  const now = new Date().toISOString();

  await sql.transaction((txSql) => {
    const queries = [];

    if (body.name !== undefined) {
      queries.push(txSql`UPDATE items SET name = ${body.name.trim()}, updated_at = ${now} WHERE id = ${numId}`);
    }
    if (body.notes !== undefined) {
      queries.push(txSql`UPDATE items SET notes = ${body.notes}, updated_at = ${now} WHERE id = ${numId}`);
    }
    if (body.alertDays !== undefined) {
      if (existing.type === "deadline") {
        queries.push(txSql`UPDATE deadline_items SET alert_days = ${body.alertDays} WHERE item_id = ${numId}`);
      } else {
        queries.push(txSql`UPDATE consumption_items SET alert_days = ${body.alertDays} WHERE item_id = ${numId}`);
      }
    }
    if (existing.type === "deadline" && body.startDate !== undefined) {
      queries.push(txSql`UPDATE deadline_items SET start_date = ${body.startDate} WHERE item_id = ${numId}`);
    }
    if (body.archived !== undefined) {
      const val = body.archived ? new Date().toISOString() : null;
      queries.push(txSql`UPDATE items SET archived_at = ${val}, updated_at = ${now} WHERE id = ${numId}`);
    }

    return queries;
  });

  if (body.tags !== undefined) {
    await syncItemTags(numId, body.tags);
  }

  return NextResponse.json(await getItem(numId, session.user.id));
}

// DELETE /api/items/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  const { id } = await params;
  const numId = Number(id);

  const ownershipError = await requireItemOwnership(numId, session.user.id);
  if (ownershipError) return ownershipError;

  const rows = await sql`DELETE FROM items WHERE id = ${numId} RETURNING id` as { id: number }[];
  if (rows.length === 0) return jsonError("Not found", 404);
  return new NextResponse(null, { status: 204 });
}
