"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, RotateCcw, Trash2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import type { DeadlineItemDTO, ConsumptionItemDTO } from "@/types/api";

type AnyItem = DeadlineItemDTO | ConsumptionItemDTO;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) { return d.slice(0, 10); }

// ── DeleteConfirmModal (inline copy) ─────────────────────────────────────────

function DeleteConfirmModal({
  target, onClose, onConfirm,
}: {
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
          background: "oklch(97% 0.020 25)", margin: "0 auto 16px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertTriangle size={22} style={{ color: "oklch(57% 0.195 25)" }} />
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
          <button onClick={handleConfirm} disabled={deleting}
            style={{ height: "44px", borderRadius: "12px", border: "none", background: "oklch(57% 0.195 25)", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
            {deleting ? "删除中…" : "确认删除"}
          </button>
          <button onClick={onClose} disabled={deleting}
            style={{ height: "44px", borderRadius: "12px", border: "none", background: "var(--lt-surface-2)", color: "var(--lt-ink-2)", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            取消
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ArchivedCard ──────────────────────────────────────────────────────────────

function ArchivedCard({
  item, onRestore, onDelete,
}: {
  item: AnyItem;
  onRestore: (id: number) => void;
  onDelete: (id: number, name: string) => void;
}) {
  const subtitle = item.type === "deadline"
    ? `到期 ${(item as DeadlineItemDTO).expireDate}`
    : `${(item as ConsumptionItemDTO).unit} · ${(item as ConsumptionItemDTO).logCount} 条记录`;

  return (
    <div style={{
      background: "var(--lt-surface)", borderRadius: "18px", padding: "16px 18px",
      boxShadow: "var(--lt-card-shadow)", opacity: 0.75,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* tags */}
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "4px" }}>
            {item.tags.map((t) => (
              <span key={t} style={{
                display: "inline-block", padding: "2px 8px", borderRadius: "9999px",
                background: "oklch(91.5% 0.010 135)", color: "oklch(40% 0.030 160)",
                fontSize: "10px", fontWeight: 500,
              }}>{t}</span>
            ))}
            <span style={{
              display: "inline-block", padding: "2px 8px", borderRadius: "9999px",
              background: "var(--lt-surface-2)", color: "var(--lt-ink-4)",
              fontSize: "10px", fontWeight: 500,
            }}>
              {item.type === "deadline" ? "到期提醒" : "消耗预估"}
            </span>
          </div>
          <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--lt-ink-2)", letterSpacing: "-0.01em" }}>
            {item.name}
          </div>
          <div style={{ fontSize: "12px", color: "var(--lt-ink-4)", marginTop: "3px" }}>
            {subtitle} · 归档于 {formatDate(item.archivedAt!)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: "flex", gap: "6px", justifyContent: "flex-end",
        borderTop: "1px solid var(--lt-track)", paddingTop: "10px", marginTop: "12px",
      }}>
        <button onClick={() => onRestore(item.id)} style={{
          display: "flex", alignItems: "center", gap: "5px",
          padding: "5px 10px", borderRadius: "8px", border: "none",
          background: "transparent", cursor: "pointer",
          fontSize: "12px", fontWeight: 600, color: "var(--lt-ink-3)",
        }}>
          <RotateCcw size={12} />恢复
        </button>
        <button onClick={() => onDelete(item.id, item.name)} style={{
          display: "flex", alignItems: "center", gap: "5px",
          padding: "5px 10px", borderRadius: "8px", border: "none",
          background: "transparent", cursor: "pointer",
          fontSize: "12px", fontWeight: 600, color: "oklch(57% 0.195 25)",
        }}>
          <Trash2 size={12} />彻底删除
        </button>
      </div>
    </div>
  );
}

// ── ArchivedPage ──────────────────────────────────────────────────────────────

export default function ArchivedPage() {
  const [items, setItems] = useState<AnyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dl, cs] = await Promise.all([
        fetch("/api/items?type=deadline&archived=true").then((r) => r.json()),
        fetch("/api/items?type=consumption&archived=true").then((r) => r.json()),
      ]);
      // Sort by archived_at desc
      const all: AnyItem[] = [...dl, ...cs].sort((a, b) =>
        (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "")
      );
      setItems(all);
    } finally {
      setLoading(false);
    }
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

  return (
    <>
      <div style={{ maxWidth: "540px", margin: "0 auto", padding: "0 16px" }}>
        {/* Header */}
        <div style={{ padding: "32px 0 24px", display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/" style={{
            width: "40px", height: "40px", borderRadius: "9999px",
            background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--lt-ink-2)", textDecoration: "none", flexShrink: 0,
          }}>
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

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0", color: "var(--lt-ink-4)" }}>
            <RefreshCw size={20} style={{ animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: "center", padding: "72px 24px" }}>
            <div style={{ fontSize: "40px", opacity: 0.25, marginBottom: "12px" }}>📦</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--lt-ink-2)" }}>归档列表为空</div>
            <div style={{ fontSize: "13px", color: "var(--lt-ink-4)", marginTop: "6px" }}>
              归档后的物品会出现在这里
            </div>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "48px" }}>
            {items.map((item) => (
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
