import type { IngredientKind, RecipeIngredient } from "@/types/api";

/**
 * Names that were almost always written with no amount. Used once, when `kind`
 * was added, to move those existing rows into seasonings. Not shown in the form.
 */
export const SEASONING_SEEDS = [
  "生抽", "老抽", "蚝油", "料酒", "醋", "香油",
  "豆瓣酱", "老干妈", "淀粉", "胡椒粉", "盐", "糖",
  "葱", "姜", "蒜",
] as const;

export function partitionIngredients(ingredients: RecipeIngredient[]): {
  mains: RecipeIngredient[];
  seasonings: RecipeIngredient[];
} {
  return {
    mains: ingredients.filter((ingredient) => ingredient.kind !== "seasoning"),
    seasonings: ingredients.filter((ingredient) => ingredient.kind === "seasoning"),
  };
}

export function normaliseKind(value: unknown): IngredientKind {
  return value === "seasoning" ? "seasoning" : "main";
}

/** Plain text for pasting into a note or a chat. Mains keep amounts; seasonings are names only. */
export function formatIngredientsForCopy(dishName: string, ingredients: RecipeIngredient[]): string {
  const { mains, seasonings } = partitionIngredients(ingredients);
  const lines: string[] = [];
  if (dishName.trim()) lines.push(dishName.trim());
  for (const item of mains) {
    const quantity = item.quantity.trim();
    lines.push(quantity ? `${item.name} ${quantity}` : item.name);
  }
  if (seasonings.length > 0) {
    lines.push(`辅料：${seasonings.map((item) => item.name).join("、")}`);
  }
  return lines.join("\n");
}
