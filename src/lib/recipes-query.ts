import sql from "./db";
import type { RecipeDTO, RecipeSummaryDTO, RecipeIngredient } from "@/types/api";

// ── Raw row types ──────────────────────────────────────────────────────────

interface RecipeRow {
  id: number;
  name: string;
  category: string | null;
  servings: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface IngredientRow {
  recipe_id: number;
  name: string;
  quantity: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Neon returns TIMESTAMPTZ as Date; normalise to an ISO string for the DTO. */
function iso(value: string): string {
  return new Date(value).toISOString();
}

async function fetchIngredientsByRecipeIds(
  recipeIds: number[]
): Promise<Map<number, RecipeIngredient[]>> {
  if (recipeIds.length === 0) return new Map();
  const rows = await sql`
    SELECT recipe_id, name, quantity
    FROM recipe_ingredients
    WHERE recipe_id = ANY(${recipeIds})
    ORDER BY recipe_id, position, id
  ` as IngredientRow[];

  const map = new Map<number, RecipeIngredient[]>();
  for (const r of rows) {
    const arr = map.get(r.recipe_id) ?? [];
    arr.push({ name: r.name, quantity: r.quantity });
    map.set(r.recipe_id, arr);
  }
  return map;
}

async function fetchStepCounts(recipeIds: number[]): Promise<Map<number, number>> {
  if (recipeIds.length === 0) return new Map();
  const rows = await sql`
    SELECT recipe_id, COUNT(*)::int AS step_count
    FROM recipe_steps
    WHERE recipe_id = ANY(${recipeIds})
    GROUP BY recipe_id
  ` as { recipe_id: number; step_count: number }[];
  return new Map(rows.map((r) => [r.recipe_id, r.step_count]));
}

async function fetchSteps(recipeId: number): Promise<string[]> {
  const rows = await sql`
    SELECT content FROM recipe_steps
    WHERE recipe_id = ${recipeId}
    ORDER BY position, id
  ` as { content: string }[];
  return rows.map((r) => r.content);
}

function mapSummary(
  row: RecipeRow,
  ingredients: RecipeIngredient[],
  stepCount: number
): RecipeSummaryDTO {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    servings: row.servings,
    notes: row.notes,
    ingredients,
    stepCount,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * List recipes, newest edit first.
 *
 * `q` matches the recipe name *and* ingredient names, which is what makes
 * "I have an eggplant, what can I cook" work without a separate endpoint.
 */
export async function getRecipes(userId: string, q?: string): Promise<RecipeSummaryDTO[]> {
  const pattern = q?.trim() ? `%${q.trim()}%` : null;

  const rows = await sql`
    SELECT r.id, r.name, r.category, r.servings, r.notes, r.created_at, r.updated_at
    FROM recipes r
    WHERE r.user_id = ${userId}
      AND (
        ${pattern}::text IS NULL
        OR r.name ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM recipe_ingredients i
          WHERE i.recipe_id = r.id AND i.name ILIKE ${pattern}
        )
      )
    ORDER BY r.updated_at DESC
  ` as RecipeRow[];

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [ingredientMap, stepCounts] = await Promise.all([
    fetchIngredientsByRecipeIds(ids),
    fetchStepCounts(ids),
  ]);

  return rows.map((r) =>
    mapSummary(r, ingredientMap.get(r.id) ?? [], stepCounts.get(r.id) ?? 0)
  );
}

export async function getRecipe(id: number, userId: string): Promise<RecipeDTO | null> {
  const rows = await sql`
    SELECT id, name, category, servings, notes, created_at, updated_at
    FROM recipes
    WHERE id = ${id} AND user_id = ${userId}
  ` as RecipeRow[];
  if (!rows[0]) return null;

  const [ingredientMap, steps] = await Promise.all([
    fetchIngredientsByRecipeIds([id]),
    fetchSteps(id),
  ]);

  return {
    ...mapSummary(rows[0], ingredientMap.get(id) ?? [], steps.length),
    steps,
  };
}

/** Ownership check only (no full DTO needed). */
export async function getRecipeOwner(id: number): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM recipes WHERE id = ${id}` as { user_id: string }[];
  return rows[0]?.user_id ?? null;
}

/** Distinct ingredient names already used by this user — powers input autocomplete. */
export async function getIngredientNames(userId: string): Promise<string[]> {
  const rows = await sql`
    SELECT DISTINCT i.name
    FROM recipe_ingredients i
    JOIN recipes r ON r.id = i.recipe_id
    WHERE r.user_id = ${userId}
    ORDER BY i.name
  ` as { name: string }[];
  return rows.map((r) => r.name);
}

// ── Input normalisation ────────────────────────────────────────────────────

/** Drop blank rows and trim; ingredients without a name are meaningless. */
export function normaliseIngredients(input: RecipeIngredient[] | undefined): RecipeIngredient[] {
  return (input ?? [])
    .map((i) => ({ name: (i?.name ?? "").trim(), quantity: (i?.quantity ?? "").trim() }))
    .filter((i) => i.name.length > 0);
}

export function normaliseSteps(input: string[] | undefined): string[] {
  return (input ?? []).map((s) => (s ?? "").trim()).filter((s) => s.length > 0);
}
