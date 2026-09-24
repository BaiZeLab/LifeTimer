import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getRecipe, getRecipes, normaliseIngredients, normaliseSteps } from "@/lib/recipes-query";
import { requireSession } from "@/lib/api-auth";
import type { CreateRecipeBody } from "@/types/api";

function jsonError(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

// GET /api/recipes?q=<name or ingredient>
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  return NextResponse.json(await getRecipes(session.user.id, q));
}

// POST /api/recipes
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;

  const body: CreateRecipeBody = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON", 400);
  if (!body.name?.trim()) return jsonError("name is required", 400);

  const ingredients = normaliseIngredients(body.ingredients);
  const steps = normaliseSteps(body.steps);
  if (ingredients.length > 60) return jsonError("too many ingredients", 400);
  if (steps.length > 60) return jsonError("too many steps", 400);

  try {
    // Single statement so a recipe never ends up half-written: the
    // data-modifying CTEs run even though the outer SELECT ignores them.
    const [{ id }] = await sql`
      WITH new_recipe AS (
        INSERT INTO recipes (user_id, name, category, servings, notes)
        VALUES (
          ${session.user.id},
          ${body.name.trim()},
          ${body.category?.trim() || null},
          ${body.servings?.trim() || null},
          ${body.notes?.trim() || null}
        )
        RETURNING id
      ),
      _ingredients AS (
        INSERT INTO recipe_ingredients (recipe_id, name, quantity, position)
        SELECT r.id, t.name, t.quantity, t.ord
        FROM new_recipe r,
             unnest(${ingredients.map((i) => i.name)}::text[],
                    ${ingredients.map((i) => i.quantity)}::text[])
             WITH ORDINALITY AS t(name, quantity, ord)
      ),
      _steps AS (
        INSERT INTO recipe_steps (recipe_id, content, position)
        SELECT r.id, t.content, t.ord
        FROM new_recipe r,
             unnest(${steps}::text[]) WITH ORDINALITY AS t(content, ord)
      )
      SELECT id FROM new_recipe
    ` as { id: number }[];

    return NextResponse.json(await getRecipe(id, session.user.id), { status: 201 });
  } catch (e) {
    return jsonError((e as Error).message, 400);
  }
}
