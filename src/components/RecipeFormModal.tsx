"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RecipeDTO, RecipeIngredient, CreateRecipeBody, PatchRecipeBody } from "@/types/api";
import { partitionIngredients } from "@/lib/seasonings";

/** New recipes open with a few blank rows so the first thing you see is where to type. */
const BLANK_INGREDIENTS: RecipeIngredient[] = [
  { name: "", quantity: "" },
  { name: "", quantity: "" },
  { name: "", quantity: "" },
];

export function RecipeFormModal({ open, recipe, onClose, onSaved }: {
  open: boolean;
  recipe: RecipeDTO | null;   // null = create
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [servings, setServings] = useState("");
  const [notes, setNotes] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(BLANK_INGREDIENTS);
  const [seasonings, setSeasonings] = useState<string[]>([]);
  const [seasoningDraft, setSeasoningDraft] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameInputs = useRef<(HTMLInputElement | null)[]>([]);
  const seasoningInputRef = useRef<HTMLInputElement | null>(null);
  const seasoningsRef = useRef<string[]>([]);
  const seasoningDraftRef = useRef("");
  const ingredientsRef = useRef(ingredients);
  ingredientsRef.current = ingredients;
  const [focusRow, setFocusRow] = useState<number | null>(null);

  const setSeasoningList = useCallback((next: string[]) => {
    seasoningsRef.current = next;
    setSeasonings(next);
  }, []);

  const commitSeasoningDraft = useCallback(() => {
    const name = seasoningDraftRef.current.trim();
    seasoningDraftRef.current = "";
    setSeasoningDraft("");
    if (!name || seasoningsRef.current.includes(name)) return;
    const usedAsMain = ingredientsRef.current.some((row) => row.name.trim() === name);
    if (usedAsMain) return;
    setSeasoningList([...seasoningsRef.current, name]);
  }, [setSeasoningList]);

  // Reset whenever the modal opens, so a cancelled edit never leaks into the next one
  useEffect(() => {
    if (!open) return;
    setName(recipe?.name ?? "");
    setCategory(recipe?.category ?? "");
    setServings(recipe?.servings ?? "");
    setNotes(recipe?.notes ?? "");
    const { mains, seasonings: savedSeasonings } = partitionIngredients(recipe?.ingredients ?? []);
    setIngredients(
      mains.length > 0
        ? [...mains, { name: "", quantity: "" }]
        : BLANK_INGREDIENTS
    );
    setSeasoningList(savedSeasonings.map((ingredient) => ingredient.name));
    seasoningDraftRef.current = "";
    setSeasoningDraft("");
    setSteps(recipe && recipe.steps.length > 0 ? [...recipe.steps] : [""]);
    setError("");
  }, [open, recipe, setSeasoningList]);

  useEffect(() => {
    if (focusRow === null) return;
    nameInputs.current[focusRow]?.focus();
    setFocusRow(null);
  }, [focusRow]);

  const setIngredient = useCallback((idx: number, patch: Partial<RecipeIngredient>) => {
    setIngredients((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }, []);

  const insertIngredientAfter = useCallback((idx: number) => {
    setIngredients((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, { name: "", quantity: "" });
      return next;
    });
    setFocusRow(idx + 1);
  }, []);

  const removeIngredient = useCallback((idx: number) => {
    setIngredients((prev) =>
      prev.length === 1 ? [{ name: "", quantity: "" }] : prev.filter((_, i) => i !== idx)
    );
  }, []);

  const handleSave = async () => {
    if (!name.trim()) { setError("菜名不能为空"); return; }

    const mainNames = new Set(
      ingredients.filter((ingredient) => ingredient.name.trim()).map((ingredient) => ingredient.name.trim())
    );
    commitSeasoningDraft();
    const payload: CreateRecipeBody & PatchRecipeBody = {
      name: name.trim(),
      category: category.trim() || undefined,
      servings: servings.trim() || undefined,
      notes: notes.trim() || undefined,
      ingredients: [
        ...ingredients
          .filter((ingredient) => ingredient.name.trim())
          .map((ingredient) => ({
            name: ingredient.name.trim(),
            quantity: ingredient.quantity.trim(),
            kind: "main" as const,
          })),
        ...seasoningsRef.current
          .filter((seasoning) => !mainNames.has(seasoning))
          .map((seasoning) => ({ name: seasoning, quantity: "", kind: "seasoning" as const })),
      ],
      steps: steps.filter((s) => s.trim()),
    };

    setSaving(true); setError("");
    try {
      const res = await fetch(recipe ? `/api/recipes/${recipe.id}` : "/api/recipes", {
        method: recipe ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "保存失败");
        return;
      }
      onClose();
      onSaved();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent style={{
        maxWidth: "460px", padding: "24px", gap: 0, borderRadius: "24px",
        maxHeight: "86vh", overflowY: "auto",
      }}>
        <DialogHeader style={{ marginBottom: "18px" }}>
          <DialogTitle style={{ fontSize: "17px", fontWeight: 700, color: "var(--lt-ink-1)" }}>
            {recipe ? "编辑菜品" : "记录一道菜"}
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="lt-field">
            <label className="lt-label">菜名</label>
            <input
              className="lt-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="番茄炒蛋"
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="lt-field">
              <label className="lt-label">分类</label>
              <input
                className="lt-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="家常菜"
              />
            </div>
            <div className="lt-field">
              <label className="lt-label">份量</label>
              <input
                className="lt-input"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                placeholder="2 人份"
              />
            </div>
          </div>

          {/* ── Ingredients ── */}
          <div className="lt-field">
            <label className="lt-label">
              主料
              <span style={{ fontWeight: 500, color: "var(--lt-ink-4)", marginLeft: "6px" }}>
                回车可继续加一行
              </span>
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {ingredients.map((row, idx) => (
                <div className="lt-ing-row" key={idx}>
                  <input
                    className="lt-input"
                    ref={(el) => { nameInputs.current[idx] = el; }}
                    autoComplete="off"
                    value={row.name}
                    onChange={(e) => setIngredient(idx, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); insertIngredientAfter(idx); }
                    }}
                    placeholder="食材"
                  />
                  <input
                    className="lt-input"
                    value={row.quantity}
                    onChange={(e) => setIngredient(idx, { quantity: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); insertIngredientAfter(idx); }
                    }}
                    placeholder="用量"
                  />
                  <button
                    type="button"
                    className="lt-row-remove"
                    onClick={() => removeIngredient(idx)}
                    aria-label="删除这一行"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="lt-row-add"
              onClick={() => insertIngredientAfter(ingredients.length - 1)}
            >
              <Plus size={13} />添加一行
            </button>
          </div>

          <div className="lt-field">
            <label className="lt-label" htmlFor="lt-seasoning-input">
              辅料
              <span style={{ fontWeight: 500, color: "var(--lt-ink-4)", marginLeft: "6px" }}>
                回车添加，不填用量
              </span>
            </label>
            <div
              className="lt-seasoning-wrap"
              onClick={() => seasoningInputRef.current?.focus()}
            >
              {seasonings.map((seasoning) => (
                <span key={seasoning} className="lt-seasoning-chip">
                  {seasoning}
                  <button
                    type="button"
                    className="lt-seasoning-remove"
                    aria-label={`去掉${seasoning}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSeasoningList(seasoningsRef.current.filter((name) => name !== seasoning));
                    }}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              <input
                id="lt-seasoning-input"
                ref={seasoningInputRef}
                className="lt-seasoning-input"
                autoComplete="off"
                value={seasoningDraft}
                placeholder={seasonings.length === 0 ? "生抽" : ""}
                onChange={(e) => {
                  seasoningDraftRef.current = e.target.value;
                  setSeasoningDraft(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitSeasoningDraft();
                  } else if (e.key === "Backspace" && !seasoningDraft && seasonings.length > 0) {
                    e.preventDefault();
                    setSeasoningList(seasoningsRef.current.slice(0, -1));
                  }
                }}
                onBlur={() => commitSeasoningDraft()}
              />
            </div>
          </div>

          {/* ── Steps ── */}
          <div className="lt-field">
            <label className="lt-label">做法</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {steps.map((content, idx) => (
                <div className="lt-step-row" key={idx}>
                  <span className="lt-step-num">{idx + 1}</span>
                  <textarea
                    className="lt-textarea"
                    style={{ minHeight: "56px" }}
                    value={content}
                    onChange={(e) =>
                      setSteps((prev) => prev.map((s, i) => (i === idx ? e.target.value : s)))
                    }
                    placeholder={idx === 0 ? "五花肉切块，冷水下锅焯出血沫" : "下一步做什么"}
                  />
                  <button
                    type="button"
                    className="lt-row-remove"
                    onClick={() =>
                      setSteps((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== idx)))
                    }
                    aria-label="删除这一步"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="lt-row-add"
              onClick={() => setSteps((prev) => [...prev, ""])}
            >
              <Plus size={13} />添加一步
            </button>
          </div>

          <div className="lt-field">
            <label className="lt-label">备注</label>
            <textarea
              className="lt-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="提前一晚腌，或者买肉时让老板切好"
            />
          </div>

          {error && (
            <div style={{ fontSize: "13px", color: "var(--lt-danger)" }}>{error}</div>
          )}
        </div>

        <div className="lt-modal-footer">
          <button className="lt-btn lt-btn-ghost" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="lt-btn lt-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
