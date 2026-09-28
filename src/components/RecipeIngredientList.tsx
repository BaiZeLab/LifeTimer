import type { RecipeIngredient } from "@/types/api";
import { partitionIngredients } from "@/lib/seasonings";

/** Mains stay as amount rows. Seasonings are one line of names, without repeating 适量. */
export function RecipeIngredientList({ ingredients }: { ingredients: RecipeIngredient[] }) {
  const { mains, seasonings } = partitionIngredients(ingredients);
  if (mains.length === 0 && seasonings.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {mains.map((ingredient, idx) => (
        <div key={`${ingredient.name}-${idx}`} style={{
          display: "flex", justifyContent: "space-between", gap: "12px",
          padding: "8px 0", fontSize: "14px",
          borderBottom: idx === mains.length - 1 && seasonings.length === 0
            ? "none"
            : "1px solid var(--lt-border-muted)",
        }}>
          <span style={{ color: "var(--lt-ink-2)" }}>{ingredient.name}</span>
          <span style={{ color: ingredient.quantity ? "var(--lt-ink-3)" : "var(--lt-ink-4)", flexShrink: 0 }}>
            {ingredient.quantity || "适量"}
          </span>
        </div>
      ))}
      {seasonings.length > 0 && (
        <div style={{
          padding: "8px 0", fontSize: "14px", lineHeight: 1.6, color: "var(--lt-ink-2)",
        }}>
          <span style={{ color: "var(--lt-ink-4)", marginRight: "8px" }}>辅料</span>
          {seasonings.map((ingredient) => ingredient.name).join(" · ")}
        </div>
      )}
    </div>
  );
}

const MAIN_PREVIEW = 4;
const SEASONING_PREVIEW = 6;

/** Collapsed card: mains first, seasonings on their own quieter line. */
export function RecipeIngredientSummary({ ingredients }: { ingredients: RecipeIngredient[] }) {
  const { mains, seasonings } = partitionIngredients(ingredients);
  if (mains.length === 0 && seasonings.length === 0) return null;

  const shownMains = mains.slice(0, MAIN_PREVIEW);
  const shownSeasonings = seasonings.slice(0, SEASONING_PREVIEW);
  const moreMains = mains.length - shownMains.length;
  const moreSeasonings = seasonings.length - shownSeasonings.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {shownMains.length > 0 && (
        <div style={{ fontSize: "14px", color: "var(--lt-ink-2)", lineHeight: 1.55 }}>
          {shownMains.map((item) => item.name).join(" · ")}
          {moreMains > 0 && <span style={{ color: "var(--lt-ink-4)" }}> +{moreMains}</span>}
        </div>
      )}
      {shownSeasonings.length > 0 && (
        <div style={{ fontSize: "13px", color: "var(--lt-ink-4)", lineHeight: 1.55 }}>
          辅料 {shownSeasonings.map((item) => item.name).join(" · ")}
          {moreSeasonings > 0 && <span> +{moreSeasonings}</span>}
        </div>
      )}
    </div>
  );
}
