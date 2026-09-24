import { NextRequest, NextResponse } from "next/server";
import { getIngredientNames } from "@/lib/recipes-query";
import { requireSession } from "@/lib/api-auth";

// GET /api/recipes/ingredients
// Distinct ingredient names already in use — feeds the <datalist> in the recipe
// form so "番茄" and "西红柿" don't drift apart and break ingredient search.
export async function GET(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (error) return error;
  return NextResponse.json(await getIngredientNames(session.user.id));
}
