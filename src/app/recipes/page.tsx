"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Search, RefreshCw, Pencil, Trash2,
  ChefHat, ChevronDown, AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RecipeFormModal } from "@/components/RecipeFormModal";
import { RecipeIngredientList, RecipeIngredientSummary } from "@/components/RecipeIngredientList";
import { CopyIngredientsButton } from "@/components/CopyIngredientsButton";
import { RecipeStepList } from "@/components/RecipeStepList";
import type { RecipeDTO, RecipeSummaryDTO } from "@/types/api";

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({ target, onClose, onConfirm }: {
  target: RecipeSummaryDTO | null;
  onClose: () => void;
  onConfirm: (id: number) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const handleConfirm = async () => {
    if (!target) return;
    setDeleting(true);
    try { await onConfirm(target.id); } finally { setDeleting(false); }
  };
  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && !deleting && onClose()}>
      <DialogContent style={{ maxWidth: "340px", padding: "28px 24px", gap: 0, borderRadius: "24px" }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "14px",
          background: "var(--lt-danger-hover-bg)", margin: "0 auto 16px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertTriangle size={22} style={{ color: "var(--lt-danger)" }} />
        </div>
        <DialogHeader style={{ marginBottom: "8px" }}>
          <DialogTitle style={{ fontSize: "17px", fontWeight: 700, textAlign: "center" }}>
            删除「{target?.name}」
          </DialogTitle>
        </DialogHeader>
        <p style={{ fontSize: "14px", color: "var(--lt-ink-3)", textAlign: "center", lineHeight: 1.5, margin: "0 0 24px" }}>
          用料和做法会一起删除，无法恢复。
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button onClick={handleConfirm} disabled={deleting} style={{
            height: "44px", borderRadius: "12px", border: "none",
            background: "var(--lt-danger)", color: "#fff",
            fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: deleting ? 0.6 : 1,
          }}>
            {deleting ? "删除中…" : "确认删除"}
          </button>
          <button onClick={onClose} disabled={deleting} style={{
            height: "44px", borderRadius: "12px", border: "none",
            background: "var(--lt-surface-2)", color: "var(--lt-ink-2)",
            fontSize: "14px", fontWeight: 600, cursor: "pointer",
          }}>
            取消
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── RecipeCard ────────────────────────────────────────────────────────────────

type DetailStatus = "loading" | "error";

function RecipeCard({
  recipe, expanded, stepsOpen, steps, stepsStatus,
  onToggle, onToggleSteps, onRetrySteps, onEdit, onDelete,
}: {
  recipe: RecipeSummaryDTO;
  expanded: boolean;
  stepsOpen: boolean;
  steps: string[] | undefined;
  stepsStatus: DetailStatus | undefined;
  onToggle: () => void;
  onToggleSteps: () => void;
  onRetrySteps: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  // A long card collapsing from above the fold would leave you staring at the next dish.
  const handleToggle = () => {
    const wasOffTop = expanded && (cardRef.current?.getBoundingClientRect().top ?? 0) < 0;
    onToggle();
    if (wasOffTop) {
      requestAnimationFrame(() => cardRef.current?.scrollIntoView({ block: "start" }));
    }
  };

  return (
    <div
      ref={cardRef}
      className="lt-card"
      onClick={handleToggle}
      style={{ cursor: "pointer", gap: "12px", scrollMarginTop: "12px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {recipe.category && (
            <span className="lt-tag" style={{ marginBottom: "6px" }}>{recipe.category}</span>
          )}
          <div style={{
            fontSize: "18px", fontWeight: 700, color: "var(--lt-ink-1)",
            letterSpacing: "-0.015em", marginTop: recipe.category ? "6px" : 0,
          }}>
            {recipe.name}
          </div>
          {recipe.stepCount > 0 && (
            <div style={{ fontSize: "12px", color: "var(--lt-ink-4)", marginTop: "2px" }}>
              {recipe.stepCount} 步做法
            </div>
          )}
        </div>
        <CopyIngredientsButton dishName={recipe.name} ingredients={recipe.ingredients} />
      </div>

      {!expanded && recipe.ingredients.length > 0 && (
        <RecipeIngredientSummary ingredients={recipe.ingredients} />
      )}

      {!expanded && recipe.ingredients.length === 0 && (
        <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>还没有记录用料</div>
      )}

      {/* Expanded: full amounts */}
      {expanded && (
        <div onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
          {recipe.ingredients.length > 0 && (
            <RecipeIngredientList ingredients={recipe.ingredients} />
          )}

          {recipe.servings && (
            <div style={{ fontSize: "12px", color: "var(--lt-ink-4)", marginTop: "10px" }}>
              {recipe.servings}
            </div>
          )}

          {recipe.notes && (
            <div style={{
              fontSize: "13px", color: "var(--lt-ink-3)", lineHeight: 1.6,
              marginTop: "10px", padding: "10px 12px",
              background: "var(--lt-surface-2)", borderRadius: "10px",
              whiteSpace: "pre-wrap",
            }}>
              {recipe.notes}
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--lt-border-muted)", marginTop: "12px" }}>
            {recipe.stepCount === 0 ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "12px", minHeight: "44px", paddingTop: "4px",
              }}>
                <span style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>还没有记录做法</span>
                <button className="lt-card-action" onClick={onEdit}>补充做法</button>
              </div>
            ) : (
              <button
                className="lt-steps-toggle"
                onClick={onToggleSteps}
                aria-expanded={stepsOpen}
              >
                <span>
                  做法
                  <span style={{ fontWeight: 500, color: "var(--lt-ink-4)", marginLeft: "6px" }}>
                    {recipe.stepCount} 步
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    color: "var(--lt-ink-4)", flexShrink: 0,
                    transform: stepsOpen ? "rotate(180deg)" : "none",
                    transition: "transform 180ms ease-out",
                  }}
                />
              </button>
            )}

            {stepsOpen && recipe.stepCount > 0 && (
              <div style={{ paddingBottom: "4px" }}>
                {steps ? (
                  <RecipeStepList steps={steps} />
                ) : stepsStatus === "error" ? (
                  <button className="lt-steps-retry" onClick={onRetrySteps}>
                    加载失败，点此重试
                  </button>
                ) : (
                  <div style={{ display: "flex", justifyContent: "center", padding: "16px 0", color: "var(--lt-ink-4)" }}>
                    <RefreshCw size={16} className="lt-spin" aria-label="加载做法" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{
            display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center",
            borderTop: "1px solid var(--lt-border-muted)", paddingTop: "10px",
          }}>
            <button className="lt-card-action" onClick={onEdit}>
              <Pencil size={13} />编辑
            </button>
            <button className="lt-card-action lt-card-action--danger" onClick={onDelete}>
              <Trash2 size={13} />删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RecipesPage ───────────────────────────────────────────────────────────────

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeSummaryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RecipeDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecipeSummaryDTO | null>(null);
  const [stepsOpenId, setStepsOpenId] = useState<number | null>(null);
  // Step text is not in the list payload; fetched per dish on first open.
  const [details, setDetails] = useState<Record<number, RecipeDTO>>({});
  const [detailStatus, setDetailStatus] = useState<Record<number, DetailStatus>>({});

  const firstLoad = useRef(true);
  const detailsRef = useRef(details);
  detailsRef.current = details;

  const load = useCallback(async (q: string) => {
    if (firstLoad.current) setLoading(true);
    try {
      const url = q.trim() ? `/api/recipes?q=${encodeURIComponent(q.trim())}` : "/api/recipes";
      const res = await fetch(url);
      if (res.ok) setRecipes(await res.json());
    } finally {
      firstLoad.current = false;
      setLoading(false);
    }
  }, []);

  // Search runs server-side because it also matches ingredient names
  useEffect(() => {
    const t = setTimeout(() => load(query), firstLoad.current ? 0 : 250);
    return () => clearTimeout(t);
  }, [query, load]);

  const fetchDetail = useCallback(async (id: number): Promise<RecipeDTO | null> => {
    const cached = detailsRef.current[id];
    if (cached) return cached;
    setDetailStatus((prev) => ({ ...prev, [id]: "loading" }));
    try {
      const res = await fetch(`/api/recipes/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      const detail: RecipeDTO = await res.json();
      setDetails((prev) => ({ ...prev, [id]: detail }));
      setDetailStatus((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return detail;
    } catch {
      setDetailStatus((prev) => ({ ...prev, [id]: "error" }));
      return null;
    }
  }, []);

  const toggleCard = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setStepsOpenId(null);
  }, []);

  const toggleSteps = useCallback((id: number) => {
    setStepsOpenId((prev) => (prev === id ? null : id));
    if (stepsOpenId !== id) void fetchDetail(id);
  }, [fetchDetail, stepsOpenId]);

  const invalidateDetails = useCallback(() => {
    setDetails({});
    setDetailStatus({});
  }, []);

  const openEdit = useCallback(async (id: number) => {
    const detail = await fetchDetail(id);
    if (!detail) return;
    setEditTarget(detail);
    setFormOpen(true);
  }, [fetchDetail]);

  const handleSaved = useCallback(() => {
    invalidateDetails();
    load(query);
  }, [invalidateDetails, load, query]);

  const handleDelete = useCallback(async (id: number) => {
    await fetch(`/api/recipes/${id}`, { method: "DELETE" });
    setDeleteTarget(null);
    invalidateDetails();
    load(query);
  }, [invalidateDetails, load, query]);

  const searching = query.trim().length > 0;

  return (
    <>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 20px" }}>
        {/* Header */}
        <div style={{ padding: "32px 0 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/" aria-label="返回" style={{
            width: "40px", height: "40px", borderRadius: "9999px",
            background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--lt-ink-2)", textDecoration: "none", flexShrink: 0,
          }}>
            <ArrowLeft size={18} strokeWidth={2} />
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--lt-ink-1)", letterSpacing: "-0.03em", margin: 0 }}>
              菜单
            </h1>
            <p style={{ fontSize: "13px", color: "var(--lt-ink-4)", marginTop: "2px" }}>
              {recipes.length > 0 && !searching ? `共 ${recipes.length} 道菜` : ""}
            </p>
          </div>
          <button
            onClick={() => { setEditTarget(null); setFormOpen(true); }}
            aria-label="记录一道菜"
            style={{
              flexShrink: 0, width: "44px", height: "44px", borderRadius: "9999px",
              background: "var(--lt-fab-bg)", color: "var(--lt-fab-color)",
              border: "none", cursor: "pointer", boxShadow: "var(--lt-shadow-fab)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "transform 120ms ease-out",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.07)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Search — matches dish names and ingredients */}
        <div className="lt-search-wrap" style={{ marginBottom: "16px" }}>
          <Search
            size={17}
            style={{
              position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)",
              color: "var(--lt-ink-4)", pointerEvents: "none",
            }}
          />
          <input
            className="lt-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜菜名或食材，比如「茄子」"
          />
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0", color: "var(--lt-ink-4)" }}>
            <RefreshCw size={20} className="lt-spin" />
          </div>
        )}

        {/* Empty — no recipes at all */}
        {!loading && recipes.length === 0 && !searching && (
          <div style={{ textAlign: "center", padding: "72px 24px" }}>
            <ChefHat size={36} strokeWidth={1.5} style={{ color: "var(--lt-ink-4)", opacity: 0.5, marginBottom: "14px" }} />
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--lt-ink-2)" }}>还没有记录菜品</div>
            <div style={{ fontSize: "13px", color: "var(--lt-ink-4)", marginTop: "6px", lineHeight: 1.6 }}>
              录一道菜的用料，下次做饭直接查
            </div>
          </div>
        )}

        {/* Empty — search miss */}
        {!loading && recipes.length === 0 && searching && (
          <div style={{ textAlign: "center", padding: "56px 24px", color: "var(--lt-ink-4)", fontSize: "14px" }}>
            没有用到「{query.trim()}」的菜
          </div>
        )}

        {!loading && recipes.length > 0 && (
          <div className="lt-card-list" style={{ paddingBottom: "96px" }}>
            {recipes.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                expanded={expandedId === r.id}
                stepsOpen={stepsOpenId === r.id}
                steps={details[r.id]?.steps}
                stepsStatus={detailStatus[r.id]}
                onToggle={() => toggleCard(r.id)}
                onToggleSteps={() => toggleSteps(r.id)}
                onRetrySteps={() => void fetchDetail(r.id)}
                onEdit={() => openEdit(r.id)}
                onDelete={() => setDeleteTarget(r)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        className="lt-fab"
        onClick={() => { setEditTarget(null); setFormOpen(true); }}
        aria-label="记录一道菜"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <RecipeFormModal
        open={formOpen}
        recipe={editTarget}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <DeleteConfirmModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}
