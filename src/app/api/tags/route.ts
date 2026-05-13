import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

// GET /api/tags
export async function GET(req: NextRequest) {
  const { error } = await requireSession(req);
  if (error) return error;
  const tags = await sql`SELECT * FROM tags ORDER BY name ASC`;
  return NextResponse.json(tags);
}

// POST /api/tags
export async function POST(req: NextRequest) {
  const { error } = await requireSession(req);
  if (error) return error;
  const body: { name?: string; color?: string } = await req.json().catch(() => ({}));
  if (!body.name?.trim()) return jsonError("name is required", 400);

  try {
    const [tag] = await sql`
      INSERT INTO tags (name, color) VALUES (${body.name.trim()}, ${body.color ?? "#6B7280"})
      RETURNING *
    `;
    return NextResponse.json(tag, { status: 201 });
  } catch {
    return jsonError("Tag already exists", 409);
  }
}
