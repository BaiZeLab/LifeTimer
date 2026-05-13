"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, RotateCcw, Trash2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import type { DeadlineItemDTO, ConsumptionItemDTO } from "@/types/api";
// archived page is protected by middleware; session state managed globally

type AnyItem = DeadlineItemDTO | ConsumptionItemDTO;
type FilterType = "all" | "deadline" | "consumption";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
  const thisYear = new Date().getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() === thisYear
    ? `${m}月${day}日`
    : `${d.getFullYear()}年${m}月${day}日`;
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({ target, onClose, onConfirm }: {
  target: { id: number; name: string } | null;
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
            彻底删除「{target?.name}」
          </DialogTitle>
        </DialogHeader>
        <p style={{ fontSize: "14px", color: "var(--lt-ink-3)", textAlign: "center", lineHeight: 1.5, margin: "0 0 24px" }}>
          删除后数据无法恢复，包括所有历史记录。
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

// ── ArchivedCard ──────────────────────────────────────────────────────────────

function ArchivedCard({ item, onRestore, onDelete }: {
  item: AnyItem;
  onRestore: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const actionsVisible = hovered || pinned;

  const isDeadline = item.type === "deadline";
  const subtitle = isDeadline
    ? `到期 ${formatDate((item as DeadlineItemDTO).expireDate)}`
    : `${(item as ConsumptionItemDTO).unit} · ${(item as ConsumptionItemDTO).logCount} 条记录`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setPinned((v) => !v)}
      style={{
        background: "var(--lt-surface)", borderRadius: "18px", padding: "16px 18px",
        boxShadow: "var(--lt-card-shadow)", cursor: "default",
        transition: "box-shadow 160ms ease-out, transform 160ms ease-out",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "5px" }}>
            {item.tags.map((t) => (
              <span key={t} style={{
                display: "inline-block", padding: "2px 8px", borderRadius: "9999px",
                background: "var(--lt-tag-bg)", color: "var(--lt-tag-text)",
                fontSize: "10px", fontWeight: 500,
              }}>{t}</span>
            ))}
            {/* Type badge */}
            <span style={{
              display: "inline-block", padding: "2px 8px", borderRadius: "9999px",
              background: "var(--lt-surface-2)", color: "var(--lt-ink-4)",
              fontSize: "10px", fontWeight: 500,
            }}>
              {isDeadline ? "到期提醒" : "消耗预估"}
            </span>
          </div>
          <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--lt-ink-2)", letterSpacing: "-0.01em" }}>
            {item.name}
          </div>
          <div style={{ fontSize: "12px", color: "var(--lt-ink-4)", marginTop: "3px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span>{subtitle}</span>
            <span>·</span>
            <span>归档于 {formatDate(item.archivedAt!)}</span>
          </div>
        </div>

        {/* Archived indicator */}
        <div style={{
          flexShrink: 0, width: "8px", height: "8px", borderRadius: "9999px",
          background: "var(--lt-track)", marginTop: "6px",
        }} />
      </div>

      {/* Actions */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "grid",
          gridTemplateRows: actionsVisible ? "1fr" : "0fr",
          marginTop: actionsVisible ? "12px" : "0",
          transition: "grid-template-rows 180ms ease-out",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div style={{
            display: "flex", gap: "6px", justifyContent: "flex-end",
            borderTop: "1px solid var(--lt-track)", paddingTop: "10px", paddingBottom: "2px",
            opacity: actionsVisible ? 1 : 0,
            transition: "opacity 120ms ease-out 60ms",
          }}>
            <button onClick={() => onRestore(item.id)} style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "5px 10px", borderRadius: "8px", border: "none",
              background: "transparent", cursor: "pointer",
              fontSize: "12px", fontWeight: 600, color: "var(--lt-ink-3)",
              transition: "background 120ms ease-out",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--lt-surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <RotateCcw size={12} />恢复
            </button>
            <button onClick={() => onDelete(item.id, item.name)} style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "5px 10px", borderRadius: "8px", border: "none",
              background: "transparent", cursor: "pointer",
              fontSize: "12px", fontWeight: 600, color: "var(--lt-danger)",
              transition: "background 120ms ease-out",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--lt-danger-hover-bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Trash2 size={12} />彻底删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ArchivedPage ──────────────────────────────────────────────────────────────

export default function ArchivedPage() {
  const [items, setItems] = useState<AnyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dl, cs] = await Promise.all([
        fetch("/api/items?type=deadline&archived=true").then((r) => r.json()),
        fetch("/api/items?type=consumption&archived=true").then((r) => r.json()),
      ]);
      const all: AnyItem[] = [...dl, ...cs].sort((a, b) =>
        (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "")
      );
      setItems(all);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRestore = useCallback(async (id: number) => {
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    });
    load();
  }, [load]);

  const handleDeleteConfirm = useCallback(async (id: number) => {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }, [load]);

  const filteredItems = filter === "all" ? items : items.filter((i) => i.type === filter);

  const dlCount = items.filter((i) => i.type === "deadline").length;
  const csCount = items.filter((i) => i.type === "consumption").length;

  const FILTERS: Array<{ key: FilterType; label: string; count: number }> = [
    { key: "all",         label: "全部",     count: items.length },
    { key: "deadline",    label: "到期提醒", count: dlCount },
    { key: "consumption", label: "消耗预估", count: csCount },
  ];

  return (
    <>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 20px" }}>
        {/* Header */}
        <div style={{ padding: "32px 0 24px", display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/" style={{
            width: "40px", height: "40px", borderRadius: "9999px",
            background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--lt-ink-2)", textDecoration: "none", flexShrink: 0,
            transition: "transform 120ms ease-out",
          }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1.06)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </Link>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "var(--lt-ink-1)", letterSpacing: "-0.03em", margin: 0 }}>
              归档
            </h1>
            <p style={{ fontSize: "13px", color: "var(--lt-ink-4)", marginTop: "2px" }}>
              {items.length > 0 ? `共 ${items.length} 条` : ""}
            </p>
          </div>
        </div>

        {/* Type filter pills */}
        {!loading && items.length > 0 && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
            {FILTERS.filter((f) => f.count > 0 || f.key === "all").map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "6px 14px", borderRadius: "9999px", border: "none",
                  background: filter === f.key ? "var(--lt-ink-1)" : "var(--lt-surface)",
                  color: filter === f.key ? "var(--lt-on-ink)" : "var(--lt-ink-3)",
                  fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  boxShadow: filter === f.key ? "none" : "var(--lt-card-shadow)",
                  transition: "background 150ms ease-out, color 150ms ease-out",
                }}
              >
                {f.label}
                <span style={{
                  fontSize: "11px", fontWeight: 700,
                  color: filter === f.key ? "var(--lt-on-ink)" : "var(--lt-ink-4)",
                  opacity: filter === f.key ? 0.65 : 1,
                }}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0", color: "var(--lt-ink-4)" }}>
            <RefreshCw size={20} className="lt-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && items.length === 0 && (
          <div style={{ textAlign: "center", padding: "72px 24px" }}>
            <div style={{ fontSize: "40px", opacity: 0.25, marginBottom: "12px" }}>📦</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--lt-ink-2)" }}>归档列表为空</div>
            <div style={{ fontSize: "13px", color: "var(--lt-ink-4)", marginTop: "6px" }}>
              归档后的物品会出现在这里
            </div>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && items.length > 0 && filteredItems.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--lt-ink-4)", fontSize: "14px" }}>
            该类型暂无归档
          </div>
        )}

        {/* Card list */}
        {!loading && filteredItems.length > 0 && (
          <div className="lt-card-list" style={{ paddingBottom: "48px" }}>
            {filteredItems.map((item) => (
              <ArchivedCard
                key={item.id}
                item={item}
                onRestore={handleRestore}
                onDelete={(id, name) => setDeleteTarget({ id, name })}
              />
            ))}
          </div>
        )}
      </div>

      <DeleteConfirmModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
