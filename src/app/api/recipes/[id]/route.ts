import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getRecipe, normaliseIngredients, normaliseSteps } from "@/lib/recipes-query";
import { requireSession, requireRecipeOwnership } from "@/lib/api-auth";
import type { PatchRecipeBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

type Params = { params: Promise<{ id: string }> };

// GET /api/recipes/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  const numId = Number((await params).id);

  const ownershipError = await requireRecipeOwnership(numId, session.user.id);
  if (ownershipError) return ownershipError;

  const recipe = await getRecipe(numId, session.user.id);
  if (!recipe) return jsonError("Not found", 404);
  return NextResponse.json(recipe);
}

// PATCH /api/recipes/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  const numId = Number((await params).id);

  const ownershipError = await requireRecipeOwnership(numId, session.user.id);
  if (ownershipError) return ownershipError;

  const body: PatchRecipeBody = await req.json().catch(() => ({}));
  if (body.name !== undefined && !body.name.trim()) return jsonError("name cannot be empty", 400);

  const ingredients = body.ingredients !== undefined ? normaliseIngredients(body.ingredients) : null;
  const steps = body.steps !== undefined ? normaliseSteps(body.steps) : null;
  if (ingredients && ingredients.length > 60) return jsonError("too many ingredients", 400);
  if (steps && steps.length > 60) return jsonError("too many steps", 400);

  const now = new Date().toISOString();

  await sql.transaction((txSql) => {
    const queries = [];

    if (body.name !== undefined) {
      queries.push(txSql`UPDATE recipes SET name = ${body.name.trim()}, updated_at = ${now} WHERE id = ${numId}`);
    }
    if (body.category !== undefined) {
      queries.push(txSql`UPDATE recipes SET category = ${body.category?.trim() || null}, updated_at = ${now} WHERE id = ${numId}`);
    }
    if (body.servings !== undefined) {
      queries.push(txSql`UPDATE recipes SET servings = ${body.servings?.trim() || null}, updated_at = ${now} WHERE id = ${numId}`);
    }
    if (body.notes !== undefined) {
      queries.push(txSql`UPDATE recipes SET notes = ${body.notes?.trim() || null}, updated_at = ${now} WHERE id = ${numId}`);
    }

    // Child rows are rewritten as a whole — the form always submits the full list.
    if (ingredients) {
      queries.push(txSql`DELETE FROM recipe_ingredients WHERE recipe_id = ${numId}`);
      queries.push(txSql`
        INSERT INTO recipe_ingredients (recipe_id, name, quantity, position)
        SELECT ${numId}, t.name, t.quantity, t.ord
        FROM unnest(${ingredients.map((i) => i.name)}::text[],
                    ${ingredients.map((i) => i.quantity)}::text[])
             WITH ORDINALITY AS t(name, quantity, ord)
      `);
      queries.push(txSql`UPDATE recipes SET updated_at = ${now} WHERE id = ${numId}`);
    }
    if (steps) {
      queries.push(txSql`DELETE FROM recipe_steps WHERE recipe_id = ${numId}`);
      queries.push(txSql`
        INSERT INTO recipe_steps (recipe_id, content, position)
        SELECT ${numId}, t.content, t.ord
        FROM unnest(${steps}::text[]) WITH ORDINALITY AS t(content, ord)
      `);
      queries.push(txSql`UPDATE recipes SET updated_at = ${now} WHERE id = ${numId}`);
    }

    return queries;
  });

  return NextResponse.json(await getRecipe(numId, session.user.id));
}

// DELETE /api/recipes/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  const numId = Number((await params).id);

  const ownershipError = await requireRecipeOwnership(numId, session.user.id);
  if (ownershipError) return ownershipError;

  // Ingredients and steps are removed by ON DELETE CASCADE.
  const rows = await sql`DELETE FROM recipes WHERE id = ${numId} RETURNING id` as { id: number }[];
  if (rows.length === 0) return jsonError("Not found", 404);
  return new NextResponse(null, { status: 204 });
}
