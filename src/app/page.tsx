"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Search, X, LayoutGrid, RefreshCw, RotateCcw, Trash2, PlusCircle, AlertTriangle, ChevronDown, ChevronUp, AlertCircle, Pencil, Archive, TrendingDown } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeadlineItemDTO, ConsumptionItemDTO, DeadlineRenewal, ConsumptionLog, ItemStatus } from "@/types/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
  const thisYear = new Date().getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() === thisYear
    ? `${m}月${day}日`
    : `${d.getFullYear()}年${m}月${day}日`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "deadline" | "consumption";
type AddType = "deadline" | "consumption";

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchItems<T>(type: Tab): Promise<T[]> {
  const res = await fetch(`/api/items?type=${type}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

// ── Visual config ─────────────────────────────────────────────────────────────

const BADGE_CFG: Record<ItemStatus, { bg: string; numColor: string; labelColor: string }> = {
  ok:      { bg: "oklch(85% 0.165 135)", numColor: "oklch(18% 0.045 155)", labelColor: "oklch(32% 0.040 155)" },
  warning: { bg: "oklch(80% 0.155 118)", numColor: "oklch(20% 0.042 135)", labelColor: "oklch(34% 0.038 135)" },
  danger:  { bg: "oklch(59% 0.220 27)",  numColor: "#ffffff",              labelColor: "rgba(255,255,255,0.75)" },
  expired: { bg: "oklch(59% 0.220 27)",  numColor: "#ffffff",              labelColor: "rgba(255,255,255,0.75)" },
};

const BAR_COLOR: Record<ItemStatus, string> = {
  ok:      "oklch(85% 0.165 135)",
  warning: "oklch(80% 0.155 118)",
  danger:  "oklch(59% 0.220 27)",
  expired: "oklch(59% 0.220 27)",
};

// ── DayBadge ──────────────────────────────────────────────────────────────────

function DayBadge({ daysLeft, status }: { daysLeft: number; status: ItemStatus }) {
  const cfg = BADGE_CFG[status];
  return (
    <div style={{
      width: "72px", minHeight: "72px",
      borderRadius: "18px",
      background: cfg.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      flexShrink: 0, padding: "8px 4px",
      gap: "1px",
    }}>
      {status === "expired" ? (
        <span style={{ fontSize: "12px", fontWeight: 700, color: cfg.numColor, textAlign: "center", lineHeight: 1.3 }}>
          已过期
        </span>
      ) : (
        <>
          <span style={{ fontSize: "34px", fontWeight: 800, color: cfg.numColor, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {daysLeft}
          </span>
          <span style={{ fontSize: "10px", fontWeight: 700, color: cfg.labelColor }}>
            天
          </span>
        </>
      )}
    </div>
  );
}

// ── DrainBar ──────────────────────────────────────────────────────────────────

function DrainBar({ pct, status, label = "当前剩余" }: { pct: number; status: ItemStatus; label?: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setWidth(Math.max(0, Math.min(100, pct))), 80);
    return () => clearTimeout(id);
  }, [pct]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
        <span style={{ fontSize: "12px", color: "var(--lt-ink-4)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--lt-ink-2)" }}>{pct}%</span>
      </div>
      <div style={{ height: "8px", borderRadius: "9999px", background: "var(--lt-track)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "9999px",
          background: BAR_COLOR[status],
          width: `${width}%`,
          transition: "width 700ms cubic-bezier(0.16, 1, 0.3, 1)",
        }} />
      </div>
    </div>
  );
}

// ── Tags ──────────────────────────────────────────────────────────────────────

function Tags({ tags, onTagClick }: { tags: string[]; onTagClick?: (tag: string) => void }) {
  return (
    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
      {tags.map((t) => (
        <span
          key={t} className="lt-tag"
          onClick={onTagClick ? (e) => { e.stopPropagation(); onTagClick(t); } : undefined}
          style={{ cursor: onTagClick ? "pointer" : undefined, userSelect: "none" }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// ── CardActions ───────────────────────────────────────────────────────────────

function CardActions({ children, visible }: { children: React.ReactNode; visible?: boolean }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
      display: "grid",
      gridTemplateRows: visible ? "1fr" : "0fr",
      marginTop: visible ? "2px" : "-14px",
      transition: "grid-template-rows 180ms ease-out, margin-top 180ms ease-out",
      }}
    >
      <div style={{ overflow: "hidden" }}>
        <div style={{
          display: "flex", gap: "4px", justifyContent: "flex-end",
          borderTop: "1px solid var(--lt-track)", paddingTop: "12px",
          paddingBottom: "2px",
          opacity: visible ? 1 : 0,
          transition: "opacity 120ms ease-out 60ms",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  icon, label, onClick, danger = false,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "5px",
        padding: "5px 10px", borderRadius: "8px", border: "none",
        background: "transparent", cursor: "pointer",
        fontSize: "12px", fontWeight: 600,
        color: danger ? "var(--lt-danger)" : "var(--lt-ink-3)",
        transition: "background 120ms ease-out, color 120ms ease-out",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "oklch(97% 0.020 25)" : "var(--lt-surface-2)";
        if (danger) e.currentTarget.style.color = "var(--lt-danger)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = danger ? "var(--lt-danger)" : "var(--lt-ink-3)";
      }}
    >
      {icon}{label}
    </button>
  );
}

// ── HistoryPanel ──────────────────────────────────────────────────────────────

function HistoryPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "var(--lt-surface-2)", borderRadius: "12px",
        padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px",
      }}
    >
      {children}
    </div>
  );
}

// ── DeadlineCard ──────────────────────────────────────────────────────────────

function DeadlineCard({
  item, onRenew, onEdit, onArchive, onDelete, onTagClick,
}: {
  item: DeadlineItemDTO;
  onRenew: (item: DeadlineItemDTO) => void;
  onEdit: (item: DeadlineItemDTO) => void;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  onTagClick: (tag: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [renewals, setRenewals] = useState<DeadlineRenewal[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  const actionsVisible = hovered || pinned || expanded;

  const overdueDays = item.daysLeft < 0 ? Math.abs(item.daysLeft) : 0;

  const toggleHistory = async () => {
    if (!expanded && renewals.length === 0) {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/items/${item.id}/renewals`);
        if (res.ok) setRenewals(await res.json());
      } finally {
        setLoadingHistory(false);
      }
    }
    setExpanded((v) => !v);
  };

  return (
    <div
      className="lt-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setPinned((v) => !v)}
      style={{ cursor: "default" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: 0 }}>
          <Tags tags={item.tags} onTagClick={onTagClick} />
          <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--lt-ink-1)", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            {item.name}
          </div>
          <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>
            {fmtDate(item.expireDate)} 到期
            {overdueDays > 0 && (
              <span style={{ marginLeft: "6px", color: "var(--lt-danger)", fontWeight: 600 }}>
                · 已过期 {overdueDays} 天
              </span>
            )}
          </div>
        </div>
        <DayBadge daysLeft={item.daysLeft} status={item.status} />
      </div>

      <DrainBar pct={item.drainPct} status={item.status} />

      {/* Renewal history */}
      {expanded && (
        <HistoryPanel>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--lt-ink-4)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px" }}>
            续期记录
          </div>
          {loadingHistory && <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>加载中…</div>}
          {!loadingHistory && renewals.length === 0 && (
            <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>暂无续期记录</div>
          )}
          {renewals.map((r) => (
            <div key={r.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "7px 0",
              borderBottom: "1px solid var(--lt-border-muted, oklch(91% 0.008 120))",
            }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--lt-ink-2)" }}>
                  {fmtDate(r.oldExpireDate)} → {fmtDate(r.newExpireDate)}
                </div>
                {r.notes && <div style={{ fontSize: "12px", color: "var(--lt-ink-4)", marginTop: "2px" }}>{r.notes}</div>}
              </div>
              <div style={{ fontSize: "11px", color: "var(--lt-ink-4)", flexShrink: 0, marginLeft: "12px" }}>
                {fmtDate(r.renewedAt)}
              </div>
            </div>
          ))}
        </HistoryPanel>
      )}

      <CardActions visible={actionsVisible}>
        <ActionBtn
          icon={expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          label={`续期记录${renewals.length > 0 ? ` (${renewals.length})` : ""}`}
          onClick={toggleHistory}
        />
        <div style={{ flex: 1 }} />
        <ActionBtn icon={<Pencil size={12} />} label="编辑" onClick={() => onEdit(item)} />
        <ActionBtn icon={<RotateCcw size={12} />} label="续期" onClick={() => onRenew(item)} />
        <ActionBtn icon={<Archive size={12} />} label="归档" onClick={() => onArchive(item.id)} />
        <ActionBtn icon={<Trash2 size={12} />} label="删除" onClick={() => onDelete(item.id)} danger />
      </CardActions>
    </div>
  );
}

// ── ConsumptionChart ──────────────────────────────────────────────────────────

function ConsumptionChart({ logs, unit, estimatedDays }: {
  logs: ConsumptionLog[];
  unit: string;
  estimatedDays: number;
}) {
  const validLogs = logs.filter((l) => !l.isAnomaly).sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
  if (validLogs.length < 2) return null;

  const W = 320, H = 160;
  const PAD = { top: 10, right: 12, bottom: 28, left: 42 };
  const pw = W - PAD.left - PAD.right;
  const ph = H - PAD.top - PAD.bottom;

  const times = validLogs.map((l) => new Date(l.recordedAt).getTime());
  const values = validLogs.map((l) => l.value);
  let minT = Math.min(...times), maxT = Math.max(...times);
  let minV = Math.min(...values), maxV = Math.max(...values);

  // Add prediction point if available
  const hasPred = estimatedDays > 0;
  const predT = hasPred ? Date.now() + estimatedDays * 86_400_000 : null;
  if (predT) maxT = Math.max(maxT, predT);
  minV = Math.max(0, minV * 0.9);
  maxV = maxV * 1.05 || 1;

  const rangeT = maxT - minT || 1;
  const rangeV = maxV - minV || 1;

  const tx = (t: number) => PAD.left + ((t - minT) / rangeT) * pw;
  const ty = (v: number) => PAD.top + ph - ((v - minV) / rangeV) * ph;

  const points = validLogs.map((l) => ({
    x: tx(new Date(l.recordedAt).getTime()),
    y: ty(l.value),
    topup: l.isTopup,
  }));
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Prediction extension from last point to (predT, 0)
  const lastPt = points[points.length - 1];
  const lastLog = validLogs[validLogs.length - 1];
  const predLine = hasPred && predT
    ? `${lastPt.x},${lastPt.y} ${tx(predT)},${ty(Math.max(minV, 0))}`
    : null;

  // Y axis ticks (3)
  const yTicks = [0, 0.5, 1].map((f) => {
    const v = minV + f * rangeV;
    return { y: ty(v), label: v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0) };
  });
  // X axis ticks (3)
  const xTicks = [0, 0.5, 1].map((f) => {
    const t = minT + f * rangeT;
    const d = new Date(t);
    return { x: tx(t), label: `${d.getMonth() + 1}/${d.getDate()}` };
  });

  return (
    <div style={{ margin: "8px 0", overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line key={i} x1={PAD.left} y1={t.y} x2={PAD.left + pw} y2={t.y}
            stroke="oklch(88% 0.008 120)" strokeWidth="1" />
        ))}

        {/* Y axis labels */}
        {yTicks.map((t, i) => (
          <text key={i} x={PAD.left - 4} y={t.y + 4} textAnchor="end"
            fontSize="9" fill="oklch(55% 0.015 120)">{t.label}{i === 1 ? ` ${unit}` : ""}</text>
        ))}

        {/* X axis labels */}
        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={H - 6} textAnchor="middle"
            fontSize="9" fill="oklch(55% 0.015 120)">{t.label}</text>
        ))}

        {/* Prediction line (dashed) */}
        {predLine && (
          <polyline points={predLine}
            fill="none" stroke="oklch(60% 0.060 260)" strokeWidth="1.5"
            strokeDasharray="4 3" opacity="0.6" />
        )}

        {/* Main line */}
        <polyline points={polyline}
          fill="none" stroke="oklch(50% 0.100 160)" strokeWidth="2" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.topup ? 5 : 3.5}
            fill={p.topup ? "oklch(55% 0.120 160)" : "oklch(100% 0 0)"}
            stroke={p.topup ? "oklch(40% 0.080 160)" : "oklch(50% 0.100 160)"}
            strokeWidth={p.topup ? 1.5 : 1.5} />
        ))}

        {/* Prediction end dot */}
        {hasPred && predT && (
          <circle cx={tx(predT)} cy={ty(Math.max(minV, 0))} r={3}
            fill="oklch(100% 0 0)" stroke="oklch(60% 0.060 260)" strokeWidth="1.5"
            strokeDasharray="2 2" />
        )}

        {/* Last value label */}
        <text x={lastPt.x + 5} y={lastPt.y - 5}
          fontSize="10" fontWeight="700" fill="oklch(35% 0.060 120)">
          {lastLog.value}
        </text>
      </svg>
      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "2px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--lt-ink-4)" }}>
          <svg width="16" height="8"><circle cx="4" cy="4" r="3.5" fill="oklch(100% 0 0)" stroke="oklch(50% 0.100 160)" strokeWidth="1.5" /><line x1="7" y1="4" x2="16" y2="4" stroke="oklch(50% 0.100 160)" strokeWidth="2" /></svg>
          实际示数
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--lt-ink-4)" }}>
          <svg width="16" height="8"><circle cx="4" cy="4" r="5" fill="oklch(55% 0.120 160)" stroke="oklch(40% 0.080 160)" strokeWidth="1.5" /></svg>
          补充
        </div>
        {hasPred && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--lt-ink-4)" }}>
            <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="oklch(60% 0.060 260)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
            预测
          </div>
        )}
      </div>
    </div>
  );
}

// ── ConsumptionCard ───────────────────────────────────────────────────────────

function ConsumptionCard({
  item, onAddLog, onEdit, onArchive, onDelete, onTagClick,
}: {
  item: ConsumptionItemDTO;
  onAddLog: (item: ConsumptionItemDTO) => void;
  onEdit: (item: ConsumptionItemDTO) => void;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  onTagClick: (tag: string) => void;
}) {
  const hasData = item.logCount >= 2;
  const depletionDate = hasData && item.estimatedDays > 0
    ? new Date(Date.now() + item.estimatedDays * 86_400_000).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })
    : null;
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<ConsumptionLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadLogs = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/items/${item.id}/logs`);
      if (res.ok) setLogs(await res.json());
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistory = async () => {
    if (!expanded) await loadLogs();
    setExpanded((v) => !v);
  };

  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [logDeleteTarget, setLogDeleteTarget] = useState<number | null>(null);

  const actionsVisible = hovered || pinned || expanded;

  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editLogValue, setEditLogValue] = useState("");
  const [editLogNotes, setEditLogNotes] = useState("");
  const [savingLog, setSavingLog] = useState(false);

  const startEditLog = (log: ConsumptionLog) => {
    setEditingLogId(log.id);
    setEditLogValue(String(log.value));
    setEditLogNotes(log.notes ?? "");
  };

  const cancelEditLog = () => { setEditingLogId(null); };

  const saveEditLog = async (log: ConsumptionLog) => {
    const val = parseFloat(editLogValue);
    if (isNaN(val)) return;
    setSavingLog(true);
    try {
      await fetch(`/api/items/${item.id}/logs/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: val, notes: editLogNotes || undefined }),
      });
      setEditingLogId(null);
      await loadLogs();
    } finally {
      setSavingLog(false);
    }
  };

  const toggleAnomaly = async (log: ConsumptionLog) => {
    await fetch(`/api/items/${item.id}/logs/${log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAnomaly: !log.isAnomaly }),
    });
    await loadLogs();
  };

  const deleteLog = async (logId: number) => {
    await fetch(`/api/items/${item.id}/logs/${logId}`, { method: "DELETE" });
    setLogDeleteTarget(null);
    await loadLogs();
  };

  const [showChart, setShowChart] = useState(false);

  return (
    <div
      className="lt-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setPinned((v) => !v)}
      style={{ cursor: "default" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: 0 }}>
          <Tags tags={item.tags} onTagClick={onTagClick} />
          <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--lt-ink-1)", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            {item.name}
          </div>
          <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>
            {item.unit}
            {item.logCount > 0 && ` · 最近更新 ${item.lastRecordedDaysAgo === 0 ? "今天" : `${item.lastRecordedDaysAgo} 天前`}`}
          </div>
        </div>
        {hasData && <DayBadge daysLeft={item.estimatedDays} status={item.status} />}
      </div>

      {item.logCount === 0 && (
        <div className="lt-cold-start">
          <LayoutGrid size={28} strokeWidth={1.5} />
          <span style={{ fontSize: "14px", fontWeight: 500 }}>暂无数据</span>
          <span style={{ fontSize: "12px", textAlign: "center", lineHeight: 1.4 }}>录入第一条示数以开始追踪</span>
        </div>
      )}

      {item.logCount === 1 && (
        <div style={{ background: "var(--lt-surface-2)", borderRadius: "12px", padding: "12px 14px" }}>
          <div style={{ fontSize: "11px", color: "var(--lt-ink-4)", fontWeight: 500, marginBottom: "6px" }}>
            已录入 1 条 · 再录入一次即可开始预估
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.02em" }}>
              {item.lastRecordedValue}
            </span>
            <span style={{ fontSize: "13px", color: "var(--lt-ink-3)" }}>{item.unit}</span>
            <span style={{ fontSize: "12px", color: "var(--lt-ink-4)", marginLeft: "6px" }}>
              {item.lastRecordedAt ? `录入于 ${fmtDate(item.lastRecordedAt)}` : ""}
            </span>
          </div>
        </div>
      )}

      {hasData && (
        <>
          <div className="lt-stats-grid">
            <div className="lt-stat-box">
              <div style={{ fontSize: "11px", color: "var(--lt-ink-4)", fontWeight: 500, marginBottom: "4px" }}>预计存量</div>
              <div>
                <span style={{ fontSize: "22px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.02em" }}>
                  {item.estimatedValue.toFixed(1)}
                </span>
                <span style={{ fontSize: "12px", color: "var(--lt-ink-3)", marginLeft: "3px" }}>{item.unit}</span>
              </div>
            </div>
            <div className="lt-stat-box">
              <div style={{ fontSize: "11px", color: "var(--lt-ink-4)", fontWeight: 500, marginBottom: "4px" }}>日均消耗</div>
              <div>
                <span style={{ fontSize: "22px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.02em" }}>
                  {item.dailyRate.toFixed(2)}
                </span>
                <span style={{ fontSize: "12px", color: "var(--lt-ink-3)", marginLeft: "3px" }}>{item.unit}/D</span>
              </div>
            </div>
          </div>
          <DrainBar pct={item.drainPct} status={item.status} label="健康剩余指数" />
          {depletionDate && (
            <div style={{ fontSize: "12px", color: "var(--lt-ink-4)", textAlign: "right", marginTop: "2px" }}>
              预计耗尽：<span style={{ fontWeight: 600, color: "var(--lt-ink-3)" }}>{depletionDate}</span>
            </div>
          )}
        </>
      )}

      {/* Log history */}
      {expanded && (
        <HistoryPanel>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--lt-ink-4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              示数记录
            </div>
            {logs.length >= 2 && (
              <button
                onClick={() => setShowChart((v) => !v)}
                style={{
                  fontSize: "11px", fontWeight: 600, color: "var(--lt-ink-3)",
                  background: showChart ? "var(--lt-surface-2)" : "transparent",
                  border: "none", borderRadius: "6px", padding: "2px 8px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "4px",
                }}
              >
                <TrendingDown size={11} /> {showChart ? "隐藏图表" : "查看趋势"}
              </button>
            )}
          </div>
          {showChart && logs.length >= 2 && (
            <ConsumptionChart logs={logs} unit={item.unit} estimatedDays={item.estimatedDays} />
          )}
          {loadingHistory && <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>加载中…</div>}
          {!loadingHistory && logs.length === 0 && (
            <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>暂无示数记录</div>
          )}
          {logs.map((log) => (
            <div key={log.id} style={{
              padding: "8px 0",
              borderBottom: "1px solid var(--lt-border-muted, oklch(91% 0.008 120))",
              opacity: log.isAnomaly ? 0.5 : 1,
            }}>
              {editingLogId === log.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <input
                      type="number" value={editLogValue}
                      onChange={(e) => setEditLogValue(e.target.value)}
                      style={{
                        width: "90px", padding: "4px 8px", borderRadius: "8px",
                        border: "1.5px solid var(--lt-accent)", fontSize: "14px", fontWeight: 700,
                        background: "var(--lt-surface-1)", color: "var(--lt-ink-1)",
                      }}
                      autoFocus
                    />
                    <span style={{ fontSize: "12px", color: "var(--lt-ink-4)" }}>{item.unit}</span>
                    <input
                      type="text" value={editLogNotes} placeholder="备注（可选）"
                      onChange={(e) => setEditLogNotes(e.target.value)}
                      style={{
                        flex: 1, padding: "4px 8px", borderRadius: "8px",
                        border: "1.5px solid var(--lt-border)", fontSize: "12px",
                        background: "var(--lt-surface-1)", color: "var(--lt-ink-1)",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button onClick={cancelEditLog} className="lt-btn lt-btn-ghost" style={{ padding: "3px 10px", fontSize: "12px" }}>取消</button>
                    <button
                      onClick={() => saveEditLog(log)} disabled={savingLog}
                      className="lt-btn lt-btn-primary" style={{ padding: "3px 10px", fontSize: "12px" }}
                    >
                      {savingLog ? "保存中…" : "保存"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.01em" }}>
                        {log.value}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--lt-ink-4)" }}>{item.unit}</span>
                      {log.isTopup && (
                        <span style={{
                          fontSize: "10px", fontWeight: 700, color: "oklch(40% 0.030 160)",
                          background: "var(--lt-tag-bg)", padding: "1px 6px", borderRadius: "9999px",
                        }}>充值</span>
                      )}
                      {log.isAnomaly && (
                        <span style={{
                          fontSize: "10px", fontWeight: 700, color: "var(--lt-danger)",
                          display: "flex", alignItems: "center", gap: "2px",
                        }}>
                          <AlertCircle size={10} />异常
                        </span>
                      )}
                    </div>
                    {log.notes && <div style={{ fontSize: "11px", color: "var(--lt-ink-4)" }}>{log.notes}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, marginLeft: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--lt-ink-4)" }}>
                      {fmtDate(log.recordedAt)}
                    </div>
                    <button
                      title="编辑"
                      onClick={() => startEditLog(log)}
                      style={{
                        padding: "3px", borderRadius: "6px", border: "none",
                        background: "transparent", color: "var(--lt-ink-4)",
                        cursor: "pointer", display: "flex", alignItems: "center",
                      }}
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      title={log.isAnomaly ? "取消标记异常" : "标记为异常"}
                      onClick={() => toggleAnomaly(log)}
                      style={{
                        padding: "3px 6px", borderRadius: "6px", border: "none",
                        background: log.isAnomaly ? "oklch(97% 0.020 25)" : "transparent",
                        color: log.isAnomaly ? "var(--lt-danger)" : "var(--lt-ink-4)",
                        cursor: "pointer", fontSize: "11px", fontWeight: 600,
                      }}
                    >
                      {log.isAnomaly ? "恢复" : "异常"}
                    </button>
                    <button
                      title="删除此条记录"
                      onClick={() => setLogDeleteTarget(log.id)}
                      style={{
                        padding: "3px", borderRadius: "6px", border: "none",
                        background: "transparent", color: "var(--lt-ink-4)",
                        cursor: "pointer", display: "flex", alignItems: "center",
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </HistoryPanel>
      )}

      <CardActions visible={actionsVisible}>
        <ActionBtn
          icon={expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          label={`历史记录${item.logCount > 0 ? ` (${item.logCount})` : ""}`}
          onClick={toggleHistory}
        />
        <div style={{ flex: 1 }} />
        <ActionBtn icon={<Pencil size={12} />} label="编辑" onClick={() => onEdit(item)} />
        <ActionBtn icon={<PlusCircle size={12} />} label="录入示数" onClick={() => onAddLog(item)} />
        <ActionBtn icon={<Archive size={12} />} label="归档" onClick={() => onArchive(item.id)} />
        <ActionBtn icon={<Trash2 size={12} />} label="删除" onClick={() => onDelete(item.id)} danger />
      </CardActions>

      <DeleteConfirmModal
        target={logDeleteTarget !== null ? { id: logDeleteTarget, name: "该条示数记录" } : null}
        onClose={() => setLogDeleteTarget(null)}
        onConfirm={deleteLog}
      />
    </div>
  );
}

// ── AddModal ──────────────────────────────────────────────────────────────────

function AddModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<AddType>("deadline");
  const [name, setName] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [unit, setUnit] = useState("");
  const [alertDays, setAlertDays] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => { setName(""); setExpireDate(""); setStartDate(""); setUnit(""); setAlertDays(""); setTags(""); setNotes(""); setError(""); };
  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (!name.trim()) { setError("名称不能为空"); return; }
    if (type === "deadline" && !expireDate) { setError("请选择到期日期"); return; }
    if (type === "consumption" && !unit.trim()) { setError("请填写单位"); return; }

    setSaving(true);
    setError("");
    try {
      const body =
        type === "deadline"
          ? {
              type: "deadline", name: name.trim(), expireDate,
              startDate: startDate || undefined,   // omit → backend defaults to today
              alertDays: alertDays ? Number(alertDays) : 30,
              tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
              notes: notes || undefined,
            }
          : {
              type: "consumption", name: name.trim(), unit: unit.trim(),
              alertDays: alertDays ? Number(alertDays) : 7,
              tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
              notes: notes || undefined,
            };

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "保存失败"); return; }
      reset();
      onClose();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent style={{ maxWidth: "440px", padding: "24px", gap: 0, borderRadius: "24px" }}>
        <DialogHeader style={{ marginBottom: "18px" }}>
          <DialogTitle style={{ fontSize: "18px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.02em" }}>
            新增
          </DialogTitle>
        </DialogHeader>

        <div className="lt-seg" style={{ marginBottom: "18px" }}>
          {(["deadline", "consumption"] as AddType[]).map((t) => (
            <button key={t} className={`lt-seg-btn${type === t ? " active" : ""}`} onClick={() => setType(t)}>
              {t === "deadline" ? "到期提醒" : "消耗预估"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="lt-field">
            <label className="lt-label">名称</label>
            <input className="lt-input" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={type === "deadline" ? "如：驾驶证、VPS 服务器" : "如：水表、电表"} />
          </div>

          {type === "deadline" ? (<>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="lt-field">
                <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>开始日期（可选）</label>
                <input className="lt-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="lt-field">
                <label className="lt-label">到期日期</label>
                <input className="lt-input" type="date" value={expireDate} onChange={(e) => setExpireDate(e.target.value)} />
              </div>
            </div>
            <div className="lt-field">
              <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>提前提醒天数</label>
              <input className="lt-input" type="number" value={alertDays} onChange={(e) => setAlertDays(e.target.value)}
                placeholder="默认 30 天" min="1" max="365" />
            </div>
          </>) : (<>
            <div className="lt-field">
              <label className="lt-label">单位</label>
              <input className="lt-input" value={unit} onChange={(e) => setUnit(e.target.value)}
                placeholder="如：m³、度、GB" />
            </div>
            <div className="lt-field">
              <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>预警天数</label>
              <input className="lt-input" type="number" value={alertDays} onChange={(e) => setAlertDays(e.target.value)}
                placeholder="默认 7 天" min="1" max="365" />
            </div>
          </>)}

          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>标签（可选）</label>
            <input className="lt-input" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="如：证件、订阅（逗号分隔）" />
          </div>
          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>备注（可选）</label>
            <textarea className="lt-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && (
            <div style={{ fontSize: "13px", color: "var(--lt-danger)", fontWeight: 500 }}>{error}</div>
          )}
        </div>

        <div className="lt-modal-footer">
          <button className="lt-btn lt-btn-ghost" onClick={handleClose} disabled={saving}>
            取消
          </button>
          <button className="lt-btn lt-btn-primary" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({
  item, onClose, onSaved,
}: {
  item: DeadlineItemDTO | ConsumptionItemDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [alertDays, setAlertDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item) {
      setName(item.name);
      setNotes(item.notes ?? "");
      setTags(item.tags.join(", "));
      setAlertDays(String(item.alertDays));
      setError("");
    }
  }, [item]);

  const handleSave = async () => {
    if (!name.trim()) { setError("名称不能为空"); return; }
    if (!item) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          notes: notes || null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          alertDays: alertDays ? Number(alertDays) : undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "保存失败"); return; }
      onClose();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: "400px", padding: "24px", gap: 0, borderRadius: "24px" }}>
        <DialogHeader style={{ marginBottom: "18px" }}>
          <DialogTitle style={{ fontSize: "18px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.02em" }}>
            编辑 · {item?.name}
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="lt-field">
            <label className="lt-label">名称</label>
            <input className="lt-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>
              {item?.type === "deadline" ? "提前提醒天数" : "预警天数"}
            </label>
            <input className="lt-input" type="number" value={alertDays}
              onChange={(e) => setAlertDays(e.target.value)} min="1" max="365" />
          </div>
          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>标签</label>
            <input className="lt-input" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="逗号分隔" />
          </div>
          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>备注</label>
            <textarea className="lt-textarea" value={notes} onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: "64px" }} />
          </div>
          {error && <div style={{ fontSize: "13px", color: "var(--lt-danger)", fontWeight: 500 }}>{error}</div>}
        </div>

        <div className="lt-modal-footer">
          <button className="lt-btn lt-btn-ghost" onClick={onClose} disabled={saving}>取消</button>
          <button className="lt-btn lt-btn-primary" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

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
    try { await onConfirm(target.id); }
    finally { setDeleting(false); }
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && !deleting && onClose()}>
      <DialogContent style={{ maxWidth: "340px", padding: "28px 24px", gap: 0, borderRadius: "24px" }}>
        {/* Icon */}
        <div style={{
          width: "48px", height: "48px", borderRadius: "14px",
          background: "oklch(97% 0.020 25)", margin: "0 auto 16px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertTriangle size={22} style={{ color: "var(--lt-danger)" }} strokeWidth={2} />
      </div>

        <DialogHeader style={{ marginBottom: "8px", textAlign: "center" }}>
          <DialogTitle style={{
            fontSize: "17px", fontWeight: 700, color: "var(--lt-ink-1)",
            letterSpacing: "-0.01em", textAlign: "center",
          }}>
            删除「{target?.name}」
          </DialogTitle>
        </DialogHeader>

        <p style={{
          fontSize: "14px", color: "var(--lt-ink-3)", textAlign: "center",
          lineHeight: 1.5, margin: "0 0 24px",
        }}>
          删除后数据无法恢复，包括所有历史记录。
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={handleConfirm}
            disabled={deleting}
            style={{
              height: "44px", borderRadius: "12px", border: "none",
              background: "var(--lt-danger)", color: "#fff",
              fontSize: "14px", fontWeight: 700, cursor: "pointer",
              opacity: deleting ? 0.6 : 1,
              transition: "opacity 150ms ease-out",
            }}
          >
            {deleting ? "删除中…" : "确认删除"}
          </button>
          <button
            onClick={onClose}
            disabled={deleting}
            style={{
              height: "44px", borderRadius: "12px", border: "none",
              background: "var(--lt-surface-2)", color: "var(--lt-ink-2)",
              fontSize: "14px", fontWeight: 600, cursor: "pointer",
            }}
          >
            取消
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── RenewModal ────────────────────────────────────────────────────────────────

function RenewModal({
  item, onClose, onSaved,
}: {
  item: DeadlineItemDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newExpireDate, setNewExpireDate] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill start date to old expire date when modal opens
  useEffect(() => {
    if (item) { setNewStartDate(item.expireDate); setNewExpireDate(""); setNotes(""); setError(""); }
  }, [item]);

  const handleSave = async () => {
    if (!newExpireDate) { setError("请选择新到期日期"); return; }
    if (!item) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/items/${item.id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newExpireDate,
          newStartDate: newStartDate || item.expireDate,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "续期失败"); return; }
      onClose();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: "400px", padding: "24px", gap: 0, borderRadius: "24px" }}>
        <DialogHeader style={{ marginBottom: "18px" }}>
          <DialogTitle style={{ fontSize: "18px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.02em" }}>
            续期 · {item?.name}
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Show current expiry as context */}
          <div style={{
            background: "var(--lt-surface-2)", borderRadius: "12px",
            padding: "10px 14px", fontSize: "13px", color: "var(--lt-ink-3)",
          }}>
            当前到期：<span style={{ fontWeight: 600, color: "var(--lt-ink-2)" }}>{item?.expireDate}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="lt-field">
              <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>新开始日期</label>
              <input className="lt-input" type="date" value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)} />
            </div>
            <div className="lt-field">
              <label className="lt-label">新到期日期</label>
              <input className="lt-input" type="date" value={newExpireDate}
                onChange={(e) => setNewExpireDate(e.target.value)} />
            </div>
          </div>

          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>备注（可选）</label>
            <textarea className="lt-textarea" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="如：续费1年" style={{ minHeight: "56px" }} />
          </div>

          {error && <div style={{ fontSize: "13px", color: "var(--lt-danger)", fontWeight: 500 }}>{error}</div>}
        </div>

        <div className="lt-modal-footer">
          <button className="lt-btn lt-btn-ghost" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="lt-btn lt-btn-primary" onClick={handleSave} disabled={!newExpireDate || saving}>
            {saving ? "保存中…" : "确认续期"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── LogModal ──────────────────────────────────────────────────────────────────

function LogModal({
  item, onClose, onSaved,
}: {
  item: ConsumptionItemDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const todayLocal = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
  const [value, setValue] = useState("");
  const [recordedAt, setRecordedAt] = useState(todayLocal);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item) { setValue(""); setRecordedAt(todayLocal); setNotes(""); setError(""); }
  }, [item, todayLocal]);

  const handleSave = async () => {
    const num = parseFloat(value);
    if (isNaN(num)) { setError("请输入有效数值"); return; }
    if (!item) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/items/${item.id}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: num,
          recordedAt: new Date(recordedAt).toISOString(),
          notes: notes || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "录入失败"); return; }
      onClose();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: "360px", padding: "24px", gap: 0, borderRadius: "24px" }}>
        <DialogHeader style={{ marginBottom: "18px" }}>
          <DialogTitle style={{ fontSize: "18px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.02em" }}>
            录入示数 · {item?.name}
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="lt-field">
            <label className="lt-label">当前示数（{item?.unit}）</label>
            <input
              className="lt-input"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="如：5.20"
              style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.01em" }}
              autoFocus
            />
          </div>

          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>记录日期</label>
            <input className="lt-input" type="date" value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)} />
          </div>

          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>备注（可选）</label>
            <textarea className="lt-textarea" value={notes} onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: "56px" }} />
          </div>

          {error && <div style={{ fontSize: "13px", color: "var(--lt-danger)", fontWeight: 500 }}>{error}</div>}
        </div>

        <div className="lt-modal-footer">
          <button className="lt-btn lt-btn-ghost" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="lt-btn lt-btn-primary" onClick={handleSave} disabled={!value || saving}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ isSearch, tab }: { isSearch: boolean; tab: Tab }) {
  return (
    <div style={{ textAlign: "center", padding: "72px 24px" }}>
      <div style={{ fontSize: "44px", opacity: 0.3, lineHeight: 1, marginBottom: "16px" }}>
        {isSearch ? "🔍" : tab === "deadline" ? "⏳" : "💧"}
      </div>
      <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--lt-ink-2)", marginBottom: "6px", letterSpacing: "-0.01em" }}>
        {isSearch ? "没有找到匹配的物品" : "还没有任何物品"}
      </div>
      <div style={{ fontSize: "14px", color: "var(--lt-ink-4)" }}>
        {isSearch ? "试试其他关键词" : "点击右上角「+」添加第一个"}
      </div>
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<Tab>("deadline");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState<DeadlineItemDTO | null>(null);
  const [logTarget, setLogTarget] = useState<ConsumptionItemDTO | null>(null);
  const [editTarget, setEditTarget] = useState<DeadlineItemDTO | ConsumptionItemDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const [deadlines, setDeadlines] = useState<DeadlineItemDTO[]>([]);
  const [consumptions, setConsumptions] = useState<ConsumptionItemDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dl, cs] = await Promise.all([
        fetchItems<DeadlineItemDTO>("deadline"),
        fetchItems<ConsumptionItemDTO>("consumption"),
      ]);
      setDeadlines(dl);
      setConsumptions(cs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeleteConfirm = useCallback(async (id: number) => {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }, [load]);

  const handleArchive = useCallback(async (id: number) => {
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    load();
  }, [load]);

  const q = query.toLowerCase();
  const filteredDeadlines = deadlines
    .filter((i) => i.name.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q)))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const filteredConsumptions = consumptions
    .filter((i) => i.name.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q)))
    .sort((a, b) => {
      const aInsufficient = a.logCount < 2;
      const bInsufficient = b.logCount < 2;
      if (aInsufficient !== bInsufficient) return aInsufficient ? 1 : -1;
      return a.estimatedDays - b.estimatedDays;
    });

  const isEmpty =
    tab === "deadline" ? filteredDeadlines.length === 0 : filteredConsumptions.length === 0;

  return (
    <>
      <div style={{ maxWidth: "540px", margin: "0 auto", padding: "0 16px" }}>

        {/* ── Page Header ── */}
        <div style={{ padding: "32px 0 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{
              fontSize: "32px", fontWeight: 800, color: "var(--lt-ink-1)",
              letterSpacing: "-0.03em", lineHeight: 1.1, margin: 0,
            }}>
              Life Timer
            </h1>
            <p style={{ fontSize: "14px", color: "var(--lt-ink-3)", marginTop: "4px" }}>
              追踪你的每一份资源
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
            <Link href="/archived" style={{
              width: "44px", height: "44px", borderRadius: "9999px",
              background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--lt-ink-3)", textDecoration: "none",
            }}>
              <Archive size={18} strokeWidth={1.8} />
            </Link>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                width: "44px", height: "44px", borderRadius: "9999px",
                background: "var(--lt-surface)", border: "none",
                boxShadow: "var(--lt-card-shadow)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--lt-ink-2)", transition: "transform 120ms ease-out",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="lt-tabs" style={{ marginBottom: "16px" }}>
          <button className={`lt-tab${tab === "deadline" ? " active" : ""}`}
            onClick={() => { setTab("deadline"); setQuery(""); }}>
            到期提醒
            {deadlines.some((i) => i.status === "danger" || i.status === "expired") && (
              <span style={{
                display: "inline-block", width: "6px", height: "6px",
                borderRadius: "50%", background: "var(--lt-danger)",
                marginLeft: "5px", verticalAlign: "middle",
              }} />
            )}
          </button>
          <button className={`lt-tab${tab === "consumption" ? " active" : ""}`}
            onClick={() => { setTab("consumption"); setQuery(""); }}>
            消耗预估
          </button>
        </div>

        {/* ── Search ── */}
        <div className="lt-search-wrap" style={{ marginBottom: "16px" }}>
          <Search size={16} style={{
            position: "absolute", left: "15px", top: "50%",
            transform: "translateY(-50%)", color: "var(--lt-ink-4)", pointerEvents: "none",
          }} />
          <input
            className="lt-search-input"
            placeholder="搜索物品或标签..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{
              position: "absolute", right: "14px", top: "50%",
              transform: "translateY(-50%)", background: "none", border: "none",
              cursor: "pointer", color: "var(--lt-ink-4)", display: "flex", padding: "2px",
            }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0", color: "var(--lt-ink-4)" }}>
            <RefreshCw size={20} style={{ animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Item List ── */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "48px" }}>
            {isEmpty ? (
              <EmptyState isSearch={!!query} tab={tab} />
            ) : tab === "deadline" ? (
              filteredDeadlines.map((item) => (
                <DeadlineCard
                  key={item.id} item={item}
                  onRenew={setRenewTarget}
                  onEdit={setEditTarget}
                  onArchive={handleArchive}
                  onDelete={(id) => setDeleteTarget({ id, name: item.name })}
                  onTagClick={setQuery}
                />
              ))
            ) : (
              filteredConsumptions.map((item) => (
                <ConsumptionCard
                  key={item.id} item={item}
                  onAddLog={setLogTarget}
                  onEdit={setEditTarget}
                  onArchive={handleArchive}
                  onDelete={(id) => setDeleteTarget({ id, name: item.name })}
                  onTagClick={setQuery}
                />
              ))
            )}
          </div>
        )}
      </div>

      <AddModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
      <EditModal item={editTarget} onClose={() => setEditTarget(null)} onSaved={load} />
      <RenewModal item={renewTarget} onClose={() => setRenewTarget(null)} onSaved={load} />
      <LogModal item={logTarget} onClose={() => setLogTarget(null)} onSaved={load} />
      <DeleteConfirmModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
