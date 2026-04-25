import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getDeadlineItem } from "@/lib/items-query";
import type { RenewBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

type Params = { params: Promise<{ id: string }> };

// POST /api/items/[id]/renew
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = Number(id);

  const deadline = db
    .prepare("SELECT * FROM deadline_items WHERE item_id = ?")
    .get(numId) as { expire_date: string; start_date: string | null } | undefined;
  if (!deadline) return jsonError("Not found or not a deadline item", 404);

  const body: RenewBody = await req.json().catch(() => null);
  if (!body?.newExpireDate) return jsonError("newExpireDate is required", 400);

  // New period start: caller's choice → old expire_date → today
  const newStartDate = body.newStartDate ?? deadline.expire_date;

  const renew = db.transaction(() => {
    db.prepare(
      `INSERT INTO deadline_renewals (item_id, old_expire_date, new_expire_date, notes)
       VALUES (?, ?, ?, ?)`
    ).run(numId, deadline.expire_date, body.newExpireDate, body.notes ?? null);

    db.prepare(
      "UPDATE deadline_items SET expire_date = ?, start_date = ? WHERE item_id = ?"
    ).run(body.newExpireDate, newStartDate, numId);

    db.prepare(
      "UPDATE items SET updated_at = datetime('now') WHERE id = ?"
    ).run(numId);
  });

  renew();
  return NextResponse.json(getDeadlineItem(numId));
}
