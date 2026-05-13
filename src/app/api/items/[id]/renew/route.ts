import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getDeadlineItem } from "@/lib/items-query";
import { requireSession, requireItemOwnership } from "@/lib/api-auth";
import type { RenewBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

type Params = { params: Promise<{ id: string }> };

// POST /api/items/[id]/renew
export async function POST(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  const { id } = await params;
  const numId = Number(id);

  const ownershipError = await requireItemOwnership(numId, session.user.id);
  if (ownershipError) return ownershipError;

  const rows = await sql`SELECT expire_date, start_date FROM deadline_items WHERE item_id = ${numId}` as {
    expire_date: string; start_date: string | null;
  }[];
  const deadline = rows[0];
  if (!deadline) return jsonError("Not found or not a deadline item", 404);

  const body: RenewBody = await req.json().catch(() => null);
  if (!body?.newExpireDate) return jsonError("newExpireDate is required", 400);

  const newStartDate = body.newStartDate ?? deadline.expire_date;
  const now = new Date().toISOString();

  await sql.transaction((txSql) => [
    txSql`
      INSERT INTO deadline_renewals (item_id, old_expire_date, new_expire_date, notes)
      VALUES (${numId}, ${deadline.expire_date}, ${body.newExpireDate}, ${body.notes ?? null})
    `,
    txSql`
      UPDATE deadline_items SET expire_date = ${body.newExpireDate}, start_date = ${newStartDate}
      WHERE item_id = ${numId}
    `,
    txSql`UPDATE items SET updated_at = ${now} WHERE id = ${numId}`,
  ]);

  return NextResponse.json(await getDeadlineItem(numId, session.user.id));
}
