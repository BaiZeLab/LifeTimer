"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil, RefreshCw, ChevronDown } from "lucide-react";
import { RecipeFormModal } from "@/components/RecipeFormModal";
import type { RecipeDTO } from "@/types/api";

export default function RecipeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [recipe, setRecipe] = useState<RecipeDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recipes/${id}`);
      if (!res.ok) { setNotFound(true); return; }
      setRecipe(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "96px 0", color: "var(--lt-ink-4)" }}>
        <RefreshCw size={20} className="lt-spin" />
      </div>
    );
  }

  if (notFound || !recipe) {
    return (
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "72px 24px", textAlign: "center" }}>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--lt-ink-2)" }}>菜品不存在</div>
        <Link href="/recipes" style={{ fontSize: "13px", color: "var(--lt-ink-3)", marginTop: "10px", display: "inline-block" }}>
          返回菜单
        </Link>
      </div>
    );
  }

  return (
    <>
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "0 20px 96px" }}>
        {/* Header */}
        <div style={{ padding: "32px 0 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/recipes" aria-label="返回菜单" style={{
            width: "40px", height: "40px", borderRadius: "9999px",
            background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--lt-ink-2)", textDecoration: "none", flexShrink: 0,
          }}>
            <ArrowLeft size={18} strokeWidth={2} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--lt-ink-1)", letterSpacing: "-0.03em", margin: 0 }}>
              {recipe.name}
            </h1>
            <p style={{ fontSize: "13px", color: "var(--lt-ink-4)", marginTop: "2px" }}>
              {[recipe.category, recipe.servings].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            onClick={() => setFormOpen(true)}
            aria-label="编辑"
            style={{
              flexShrink: 0, width: "44px", height: "44px", borderRadius: "9999px",
              background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
              border: "none", cursor: "pointer", color: "var(--lt-ink-3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Pencil size={17} strokeWidth={1.8} />
          </button>
        </div>

        {/* Ingredients — collapsed by default: once you've prepped, steps are what matter */}
        <div className="lt-card" style={{ gap: "10px", padding: "16px 18px", marginBottom: "14px" }}>
          <button
            onClick={() => setIngredientsOpen((v) => !v)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: "12px", width: "100%", minHeight: "28px",
              background: "transparent", border: "none", padding: 0, cursor: "pointer",
              textAlign: "left", fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--lt-ink-2)" }}>
              用料 {recipe.ingredients.length > 0 && `(${recipe.ingredients.length})`}
            </span>
            <ChevronDown
              size={16}
              style={{
                color: "var(--lt-ink-4)", flexShrink: 0,
                transform: ingredientsOpen ? "rotate(180deg)" : "none",
                transition: "transform 180ms ease-out",
              }}
            />
          </button>

          {recipe.ingredients.length === 0 ? (
            <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>还没有记录用料</div>
          ) : ingredientsOpen ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recipe.ingredients.map((ing, idx) => (
                <div key={idx} style={{
                  display: "flex", justifyContent: "space-between", gap: "12px",
                  padding: "8px 0", fontSize: "14px",
                  borderBottom: idx === recipe.ingredients.length - 1 ? "none" : "1px solid var(--lt-border-muted)",
                }}>
                  <span style={{ color: "var(--lt-ink-2)" }}>{ing.name}</span>
                  <span style={{ color: ing.quantity ? "var(--lt-ink-3)" : "var(--lt-ink-4)", flexShrink: 0 }}>
                    {ing.quantity || "适量"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: "13px", color: "var(--lt-ink-3)", lineHeight: 1.6 }}>
              {recipe.ingredients.map((i) => i.name).join(" · ")}
            </div>
          )}
        </div>

        {/* Steps — the reading view: bigger type, generous spacing, phone propped on the counter */}
        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--lt-ink-2)", margin: "20px 4px 12px" }}>
          做法
        </div>

        {recipe.steps.length === 0 ? (
          <div className="lt-card" style={{ padding: "24px 18px", alignItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: "var(--lt-ink-4)", lineHeight: 1.6 }}>
              还没有记录做法
            </div>
            <button
              onClick={() => setFormOpen(true)}
              style={{
                marginTop: "12px", height: "36px", padding: "0 16px", borderRadius: "10px",
                border: "none", background: "var(--lt-surface-2)", color: "var(--lt-ink-2)",
                fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              补充做法
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {recipe.steps.map((content, idx) => (
              <div key={idx} style={{
                display: "grid", gridTemplateColumns: "30px 1fr", gap: "12px",
                alignItems: "start", padding: "14px 4px",
                borderBottom: idx === recipe.steps.length - 1 ? "none" : "1px solid var(--lt-border-muted)",
              }}>
                <span style={{
                  width: "26px", height: "26px", borderRadius: "9999px",
                  background: "var(--lt-surface-2)", color: "var(--lt-ink-3)",
                  fontSize: "12px", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: "1px",
                }}>
                  {idx + 1}
                </span>
                <div style={{
                  fontSize: "16px", lineHeight: 1.7, color: "var(--lt-ink-1)",
                  whiteSpace: "pre-wrap",
                }}>
                  {content}
                </div>
              </div>
            ))}
          </div>
        )}

        {recipe.notes && (
          <div style={{
            marginTop: "20px", padding: "14px 16px",
            background: "var(--lt-surface-2)", borderRadius: "12px",
            fontSize: "14px", lineHeight: 1.7, color: "var(--lt-ink-3)",
            whiteSpace: "pre-wrap",
          }}>
            {recipe.notes}
          </div>
        )}
      </div>

      <RecipeFormModal
        open={formOpen}
        recipe={recipe}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
    </>
  );
}
