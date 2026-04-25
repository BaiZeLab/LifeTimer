import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

// GET /api/tags
export function GET() {
  const tags = db.prepare("SELECT * FROM tags ORDER BY name ASC").all();
  return NextResponse.json(tags);
}

// POST /api/tags
export async function POST(req: NextRequest) {
  const body: { name?: string; color?: string } = await req.json().catch(() => ({}));
  if (!body.name?.trim()) return jsonError("name is required", 400);

  try {
    const result = db
      .prepare("INSERT INTO tags (name, color) VALUES (?, ?)")
      .run(body.name.trim(), body.color ?? "#6B7280");
    const tag = db
      .prepare("SELECT * FROM tags WHERE id = ?")
      .get(result.lastInsertRowid);
    return NextResponse.json(tag, { status: 201 });
  } catch {
    return jsonError("Tag already exists", 409);
  }
}
