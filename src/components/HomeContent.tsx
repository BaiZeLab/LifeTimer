"use client";

import React, { useState, useEffect, useCallback, useRef, useReducer } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Search, X, LayoutGrid, RefreshCw, RotateCcw, Trash2, PlusCircle,
  AlertTriangle, ChevronDown, ChevronUp, AlertCircle, Pencil, Archive,
  TrendingDown, MoreHorizontal, Timer, Gauge, LogOut, Settings, LogIn,
  Sun, Moon, Bell, BellOff, Webhook,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import Link from "next/link";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type {
  DeadlineItemDTO, ConsumptionItemDTO, DeadlineRenewal, ConsumptionLog,
  ItemStatus, CreateItemBody, PatchItemBody, RenewBody, CreateLogBody, PatchLogBody,
} from "@/types/api";
import { useSession, signOut } from "@/lib/auth-client";
import { calcDeadlineMetrics, calcConsumptionEstimate } from "@/lib/algorithms";
import type { LogRow } from "@/lib/algorithms";
import {
  buildDemoDeadlines, buildDemoConsumptions, buildDemoLogs, nextDemoId, daysAgo,
} from "@/lib/demo-data";

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

function fmtFullDate(dateStr: string): string {
  const d = new Date(dateStr.slice(0, 10) + "T00:00:00");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtDateRange(
  startDate: string | null | undefined,
  endDate: string,
  missingStartLabel = "未填写"
): string {
  return `${startDate ? fmtFullDate(startDate) : missingStartLabel} - ${fmtFullDate(endDate)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "deadline" | "consumption";
type AddType = "deadline" | "consumption";
type ExpandedCardKey = `${Tab}:${number}` | null;

type DeadlineHistoryEntry = {
  id: string;
  kind: "initial" | "renewal";
  rangeStartDate: string | null;
  rangeStartMissingLabel?: string;
  rangeEndDate: string;
  previousRangeStartDate?: string | null;
  previousRangeStartMissingLabel?: string;
  previousRangeEndDate?: string;
  renewedAt: string | null;
  notes: string | null;
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchItems<T>(type: Tab): Promise<T[]> {
  const res = await fetch(`/api/items?type=${type}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

// ── Visual config ─────────────────────────────────────────────────────────────

const BAR_COLOR: Record<ItemStatus, string> = {
  ok:      "var(--lt-ok)",
  warning: "var(--lt-warn)",
  danger:  "var(--lt-danger)",
  expired: "var(--lt-expired-color)",
};

const BADGE_CFG: Record<ItemStatus, { arcColor: string; numColor: string; labelColor: string }> = {
  ok:      { arcColor: BAR_COLOR.ok,      numColor: "var(--lt-ink-1)",  labelColor: "var(--lt-ink-3)" },
  warning: { arcColor: BAR_COLOR.warning,  numColor: "var(--lt-ink-1)",  labelColor: "var(--lt-ink-3)" },
  danger:  { arcColor: BAR_COLOR.danger,   numColor: "var(--lt-danger)", labelColor: "var(--lt-danger)" },
  expired: { arcColor: BAR_COLOR.expired,  numColor: "var(--lt-ink-3)", labelColor: "var(--lt-ink-4)" },
};

// ── DayBadge ──────────────────────────────────────────────────────────────────

// Quarter-mark ticks just outside the track ring — the same fixed reading
// grid as the status bar below, so "about a quarter left" reads instantly
// without following the arc all the way around. Static, not part of the
// animated value, like the printed marks on a real meter face.
const TICK_R1 = 31, TICK_R2 = 34;
const TICK_POINTS: Array<{ x1: number; y1: number; x2: number; y2: number }> = [
  { x1: 0, y1: -TICK_R1, x2: 0, y2: -TICK_R2 },   // 100% — top
  { x1: TICK_R1, y1: 0, x2: TICK_R2, y2: 0 },     // 75%  — right
  { x1: 0, y1: TICK_R1, x2: 0, y2: TICK_R2 },     // 50%  — bottom
  { x1: -TICK_R1, y1: 0, x2: -TICK_R2, y2: 0 },   // 25%  — left
];

function DayBadge({ daysLeft, status, pct }: { daysLeft: number; status: ItemStatus; pct: number }) {
  const cfg = BADGE_CFG[status];
  const SIZE = 72, R = 28, CX = 36, CY = 36;
  const CIRC = 2 * Math.PI * R;
  const remaining = Math.max(0, Math.min(100, pct));

  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAnimPct(remaining), 80);
    return () => clearTimeout(id);
  }, [remaining]);

  const arcLen = (animPct / 100) * CIRC;

  return (
    <div style={{ position: "relative", width: `${SIZE}px`, height: `${SIZE}px`, flexShrink: 0 }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${CX} ${CY})`}>
          {TICK_POINTS.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke="var(--lt-tick)" strokeWidth="1.5" strokeLinecap="round" />
          ))}
        </g>
        <circle cx={CX} cy={CY} r={R} fill="none"
          stroke="var(--lt-track)" strokeWidth="3.5" />
        {status === "expired" ? (
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke={cfg.arcColor} strokeWidth="3.5"
            strokeDasharray={`${CIRC} 0`}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
            opacity="0.35"
          />
        ) : (
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke={cfg.arcColor} strokeWidth="3.5"
            strokeDasharray={`${arcLen} ${CIRC}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        )}
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "3px",
      }}>
        {status === "expired" ? (
          <span style={{ fontSize: "11px", fontWeight: 700, color: cfg.numColor, textAlign: "center", lineHeight: 1.2 }}>
            已过期
          </span>
        ) : (
          <>
            <span style={{
              fontSize: daysLeft > 999 ? "15px" : daysLeft > 99 ? "19px" : daysLeft > 9 ? "26px" : "28px",
              fontWeight: 700, color: cfg.numColor, lineHeight: 1, letterSpacing: "-0.025em",
            }}>
              {Math.abs(daysLeft)}
            </span>
            <span style={{ fontSize: "10px", fontWeight: 600, color: cfg.labelColor, lineHeight: 1 }}>天</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── DrainBar ──────────────────────────────────────────────────────────────────

function DrainBar({ pct, status, label = "当前剩余" }: { pct: number; status: ItemStatus; label?: string }) {
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setScale(Math.max(0, Math.min(100, pct)) / 100), 80);
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
          width: "100%",
          transformOrigin: "left center",
          transform: `scaleX(${scale})`,
          transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
        }} />
      </div>
    </div>
  );
}

// ── StatusSummary ─────────────────────────────────────────────────────────────

function StatusSummary({ items }: { items: Array<{ status: ItemStatus }> }) {
  if (items.length === 0) return null;
  const counts: Record<ItemStatus, number> = { ok: 0, warning: 0, danger: 0, expired: 0 };
  items.forEach((i) => counts[i.status]++);
  const total = items.length;

  const segments = (
    [
      { key: "ok"      as ItemStatus, color: BAR_COLOR.ok,      label: "正常",   count: counts.ok },
      { key: "warning" as ItemStatus, color: BAR_COLOR.warning,  label: "预警",   count: counts.warning },
      { key: "danger"  as ItemStatus, color: BAR_COLOR.danger,   label: "紧急",   count: counts.danger },
      { key: "expired" as ItemStatus, color: BAR_COLOR.expired,  label: "已过期", count: counts.expired },
    ] as Array<{ key: ItemStatus; color: string; label: string; count: number }>
  ).filter((s) => s.count > 0);

  const urgentCount = counts.danger + counts.expired + counts.warning;
  const summaryText = urgentCount > 0
    ? `${urgentCount} 项需关注 · ${counts.ok} 项正常`
    : `共 ${total} 项，全部正常`;

  return (
    <div className="lt-status-summary">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {segments.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "3px", background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "var(--lt-ink-3)", fontWeight: 500 }}>{s.label}</span>
              <span style={{ fontSize: "12px", color: "var(--lt-ink-2)", fontWeight: 700 }}>{s.count}</span>
            </div>
          ))}
        </div>
        <span style={{
          fontSize: "12px", fontWeight: 600,
          color: urgentCount > 0 ? "var(--lt-danger)" : "var(--lt-ink-4)",
        }}>
          {summaryText}
        </span>
      </div>
      <div className="lt-status-bar">
        {segments.map((s) => (
          <div key={s.key} style={{
            height: "100%",
            width: `${(s.count / total) * 100}%`,
            background: s.color,
          }} />
        ))}
        {[25, 50, 75].map((mark) => (
          <div key={mark} className="lt-status-tick" style={{ left: `${mark}%` }} />
        ))}
      </div>
    </div>
  );
}

// ── Tags ──────────────────────────────────────────────────────────────────────

function Tags({ tags, onTagClick }: { tags: string[]; onTagClick?: (tag: string) => void }) {
  return (
    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
      {tags.map((t) => (
        <span key={t} className="lt-tag"
          onClick={onTagClick ? (e) => { e.stopPropagation(); onTagClick(t); } : undefined}
          style={{ cursor: onTagClick ? "pointer" : undefined, userSelect: "none" }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// ── TagInput ──────────────────────────────────────────────────────────────────

function TagInput({
  tags, onChange, placeholder,
}: {
  tags: string[]; onChange: (tags: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/,+$/, "");
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="lt-tag-input-wrap" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag) => (
        <span key={tag} className="lt-tag-chip">
          {tag}
          <button
            type="button"
            className="lt-tag-chip-remove"
            onClick={(e) => { e.stopPropagation(); onChange(tags.filter((t) => t !== tag)); }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input); }}
        placeholder={tags.length === 0 ? (placeholder ?? "输入后按回车添加") : ""}
        style={{
          flex: 1, minWidth: "80px", border: "none", outline: "none",
          background: "transparent", fontSize: "14px", color: "var(--lt-ink-1)",
          fontFamily: "inherit", padding: "2px 0",
        }}
      />
    </div>
  );
}

// ── OverflowMenu ──────────────────────────────────────────────────────────────

function OverflowMenu({ onArchive, onDelete }: { onArchive: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!dropRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    window.addEventListener("scroll", closeOnScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  const dropdown = mounted && open ? createPortal(
    <div ref={dropRef} style={{
      position: "fixed",
      top: pos.top,
      right: pos.right,
      background: "var(--lt-surface)",
      borderRadius: "12px",
      boxShadow: "0 4px 20px oklch(16% 0.040 46 / 0.18), 0 1px 4px oklch(16% 0.040 46 / 0.10)",
      padding: "5px",
      minWidth: "108px",
      zIndex: 9999,
      border: "1px solid var(--lt-border-muted)",
    }}>
      <button className="lt-overflow-item" onClick={() => { onArchive(); setOpen(false); }}>
        <Archive size={13} />归档
      </button>
      <button className="lt-overflow-item danger" onClick={() => { onDelete(); setOpen(false); }}>
        <Trash2 size={13} />删除
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className="lt-overflow-menu" onClick={(e) => e.stopPropagation()}>
        <button
          ref={btnRef}
          onClick={handleToggle}
          style={{
            display: "flex", alignItems: "center",
            padding: "5px 8px", borderRadius: "8px", border: "none",
            background: open ? "var(--lt-surface-2)" : "transparent",
            cursor: "pointer", color: "var(--lt-ink-3)",
            transition: "background 120ms ease-out",
          }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = "var(--lt-surface-2)"; }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
      {dropdown}
    </>
  );
}

// ── HeaderMenu ────────────────────────────────────────────────────────────────
// Collapses secondary header actions (webhook, archived, iOS hint) into a single
// 44px trigger so the icon row never competes with the title for space.

function HeaderMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <div className="lt-header-menu" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="更多"
        style={{
          flexShrink: 0,
          width: "44px", height: "44px", borderRadius: "9999px",
          background: open ? "var(--lt-surface-2)" : "var(--lt-surface)",
          boxShadow: "var(--lt-card-shadow)",
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--lt-ink-3)",
          transition: "transform 120ms ease-out, background 120ms ease-out",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.07)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <MoreHorizontal size={18} strokeWidth={1.8} />
      </button>
      {open && (
        <div className="lt-header-menu-dropdown" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── CardActions ───────────────────────────────────────────────────────────────

function CardActions({ children, visible }: { children: React.ReactNode; visible?: boolean }) {
  return (
    <div onClick={(e) => e.stopPropagation()}
      className={visible ? "lt-card-actions lt-card-actions--open" : "lt-card-actions"}
      style={{
        display: "grid",
        gridTemplateRows: visible ? "1fr" : "0fr",
        marginTop: visible ? "2px" : "-14px",
        transition: "grid-template-rows 180ms ease-out",
      }}>
      <div style={{ overflow: "hidden" }}>
        <div className="lt-card-actions-inner" style={{
          display: "flex", gap: "4px", justifyContent: "flex-end", alignItems: "center",
          borderTop: "1px solid var(--lt-track)", paddingTop: "12px", paddingBottom: "2px",
          opacity: visible ? 1 : 0,
          transition: "opacity 120ms ease-out 60ms",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, danger = false }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "5px",
      padding: "5px 10px", borderRadius: "8px", border: "none",
      background: "transparent", cursor: "pointer",
      fontSize: "12px", fontWeight: 600,
      color: danger ? "var(--lt-danger)" : "var(--lt-ink-3)",
      transition: "background 120ms ease-out, color 120ms ease-out",
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "var(--lt-danger-hover-bg)" : "var(--lt-surface-2)";
      }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {icon}{label}
    </button>
  );
}

// ── HistoryPanel ──────────────────────────────────────────────────────────────

function HistoryPanel({ children }: { children: React.ReactNode }) {
  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      background: "var(--lt-surface-2)", borderRadius: "12px",
      padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px",
    }}>
      {children}
    </div>
  );
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="lt-card" style={{ pointerEvents: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="lt-skeleton" style={{ width: "56px", height: "20px", borderRadius: "9999px" }} />
          <div className="lt-skeleton" style={{ width: "165px", height: "24px", borderRadius: "8px" }} />
          <div className="lt-skeleton" style={{ width: "110px", height: "14px", borderRadius: "6px" }} />
        </div>
        <div className="lt-skeleton" style={{ width: "72px", height: "72px", borderRadius: "9999px", flexShrink: 0 }} />
      </div>
      <div className="lt-skeleton" style={{ height: "8px", borderRadius: "9999px", width: "100%" }} />
    </div>
  );
}

// ── ConsumptionHeatmap ────────────────────────────────────────────────────────

/**
 * GitHub-style calendar heatmap showing daily consumption intensity.
 * Columns = weeks (oldest left → newest right), rows = weekday (Mon–Sun).
 */
function ConsumptionHeatmap({ logs, unit, status }: {
  logs: ConsumptionLog[];
  unit: string;
  status: ItemStatus;
}) {
  const validLogs = logs
    .filter((l) => !l.isAnomaly)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (validLogs.length < 2) return null;

  // Build a map of dateString → daily consumption rate
  const dailyMap = new Map<string, number>();

  for (let i = 0; i < validLogs.length - 1; i++) {
    const a = validLogs[i], b = validLogs[i + 1];
    if (b.isTopup || b.value >= a.value) continue;
    const startT = new Date(a.recordedAt).getTime();
    const endT   = new Date(b.recordedAt).getTime();
    const days   = (endT - startT) / 86_400_000;
    if (days <= 0) continue;
    const rate = (a.value - b.value) / days;
    // Distribute evenly across each day in this interval
    for (let d = 0; d < Math.ceil(days); d++) {
      const t   = startT + d * 86_400_000;
      const key = new Date(t).toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + rate);
    }
  }

  // Build 52-week grid ending today
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0=Sun
  // Align end to Saturday so the last column ends today's week
  const endDate  = new Date(today.getTime() + (6 - dayOfWeek) * 86_400_000);
  const startDate = new Date(endDate.getTime() - 52 * 7 * 86_400_000);

  // Build weeks array
  const weeks: { date: Date; key: string; rate: number }[][] = [];
  let week: { date: Date; key: string; rate: number }[] = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const key = cur.toISOString().slice(0, 10);
    week.push({ date: new Date(cur), key, rate: dailyMap.get(key) ?? 0 });
    if (week.length === 7) { weeks.push(week); week = []; }
    cur.setDate(cur.getDate() + 1);
  }
  if (week.length) weeks.push(week);

  // Max rate for scaling
  const maxRate = Math.max(...[...dailyMap.values()], 0.001);

  const lineColor = CHART_LINE_COLOR[status];
  // Parse the lineColor intensity into a usable opacity mapping
  function cellColor(rate: number): string {
    if (rate <= 0) return "var(--lt-track)";
    const t = Math.min(1, rate / maxRate);
    const opacity = 0.12 + t * 0.88;
    return `color-mix(in oklch, ${lineColor} ${Math.round(opacity * 100)}%, transparent)`;
  }

  const CELL = 11, GAP = 2;
  const svgW = weeks.length * (CELL + GAP);
  const svgH = 7 * (CELL + GAP);

  // Month labels
  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstDay = week.find((d) => d.date.getDate() <= 7);
    if (firstDay) {
      const m = firstDay.date.getMonth();
      if (m !== lastMonth) {
        monthLabels.push({
          x: wi * (CELL + GAP),
          label: `${firstDay.date.getMonth() + 1}月`,
        });
        lastMonth = m;
      }
    }
  });

  return (
    <div style={{ margin: "8px 0", overflowX: "auto" }}>
      <svg
        width={svgW}
        height={svgH + 16}
        viewBox={`0 0 ${svgW} ${svgH + 16}`}
        style={{ display: "block", minWidth: svgW }}
      >
        {/* Month labels */}
        {monthLabels.map((ml) => (
          <text key={ml.x} x={ml.x} y={9} fontSize="8" fill="var(--lt-ink-4)">{ml.label}</text>
        ))}
        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => (
            <rect
              key={day.key}
              x={wi * (CELL + GAP)}
              y={di * (CELL + GAP) + 14}
              width={CELL}
              height={CELL}
              rx={2}
              fill={cellColor(day.rate)}
              style={{ cursor: day.rate > 0 ? "default" : undefined }}
            >
              {day.rate > 0 && (
                <title>{day.key}: {day.rate.toFixed(2)} {unit}/天</title>
              )}
            </rect>
          ))
        )}
      </svg>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px", justifyContent: "flex-end" }}>
        <span style={{ fontSize: "10px", color: "var(--lt-ink-4)" }}>少</span>
        {[0.1, 0.35, 0.6, 0.85, 1].map((t) => (
          <div key={t} style={{
            width: 10, height: 10, borderRadius: 2,
            background: `color-mix(in oklch, ${lineColor} ${Math.round((0.12 + t * 0.88) * 100)}%, transparent)`,
          }} />
        ))}
        <span style={{ fontSize: "10px", color: "var(--lt-ink-4)" }}>多</span>
      </div>
    </div>
  );
}

// ── ConsumptionChart ──────────────────────────────────────────────────────────

const CHART_LINE_COLOR: Record<ItemStatus, string> = {
  ok:      "var(--lt-ok-deep)",
  warning: "var(--lt-warn-deep)",
  danger:  "var(--lt-danger-deep)",
  expired: "var(--lt-expired-deep)",
};

function buildBezierPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], curr = pts[i];
    const cpX = (curr.x - prev.x) * 0.38;
    d += ` C ${prev.x + cpX} ${prev.y}, ${curr.x - cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function LegendDot({ color, filled }: { color: string; filled?: boolean }) {
  return (
    <svg width="14" height="8" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="4" r="3.5"
        fill={filled ? color : "var(--lt-surface)"}
        stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function LegendDash({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="16" height="8" style={{ flexShrink: 0 }}>
      <line x1="0" y1="4" x2="16" y2="4"
        stroke={color} strokeWidth="1.5"
        strokeDasharray={dashed ? "4 3" : undefined} />
    </svg>
  );
}

type ChartRange = "30" | "90" | "all";

function ConsumptionChart({ logs, unit, estimatedDays, status, chartId, timeRange }: {
  logs: ConsumptionLog[];
  unit: string;
  estimatedDays: number;
  status: ItemStatus;
  chartId: string;
  timeRange: ChartRange;
}) {
  // Filter logs by time range before passing to chart logic
  const cutoff = timeRange !== "all"
    ? Date.now() - Number(timeRange) * 86_400_000
    : 0;

  const validLogs = logs.filter((l) => !l.isAnomaly && (cutoff === 0 || new Date(l.recordedAt).getTime() >= cutoff)).sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
  if (validLogs.length < 2) return null;

  const W = 320, H = 180;
  const PAD = { top: 14, right: 18, bottom: 32, left: 44 };
  const pw = W - PAD.left - PAD.right;
  const ph = H - PAD.top - PAD.bottom;

  const times = validLogs.map((l) => new Date(l.recordedAt).getTime());
  const values = validLogs.map((l) => l.value);
  let minT = Math.min(...times), maxT = Math.max(...times);
  let minV = Math.min(...values), maxV = Math.max(...values);

  const hasPred = estimatedDays > 0;
  const nowT = Date.now();
  const maxDataT = Math.max(...times);
  const dataSpanMs = maxDataT - minT || 1;

  // Adaptive cap: prediction extends at most 1.2× historical span from last data point,
  // so historical data always occupies ≥45% of the x-axis width.
  const predCapMs = Math.max(30 * 86_400_000, dataSpanMs * 1.2);
  const fullPredEndT = hasPred ? nowT + estimatedDays * 86_400_000 : null;
  const predT = hasPred ? Math.min(fullPredEndT!, maxDataT + predCapMs) : null;
  const predTruncated = hasPred && fullPredEndT! > maxDataT + predCapMs;

  if (predT) maxT = Math.max(maxT, predT);
  maxT = Math.max(maxT, nowT);
  minV = Math.max(0, minV * 0.88);
  maxV = maxV * 1.06 || 1;

  const rangeT = maxT - minT || 1;
  const rangeV = maxV - minV || 1;

  const tx = (t: number) => PAD.left + ((t - minT) / rangeT) * pw;
  const ty = (v: number) => PAD.top + ph - ((v - minV) / rangeV) * ph;
  const baseY = ty(minV);

  const points = validLogs.map((l) => ({
    x: tx(new Date(l.recordedAt).getTime()),
    y: ty(l.value),
    topup: l.isTopup,
    value: l.value,
  }));

  const linePath = buildBezierPath(points);
  const areaPath = linePath
    + ` L ${points[points.length - 1].x} ${baseY}`
    + ` L ${points[0].x} ${baseY} Z`;

  const lastPt = points[points.length - 1];
  const lastLog = validLogs[validLogs.length - 1];
  const lastDataValue = lastLog.value;
  const depleteValue = Math.max(minV, 0);

  // When prediction is truncated, interpolate the endpoint Y value instead of
  // snapping to the chart bottom, which would be visually misleading.
  let predEndValue = depleteValue;
  if (hasPred && predT && fullPredEndT && predTruncated) {
    const fullSpan = fullPredEndT - maxDataT;
    const partialSpan = predT - maxDataT;
    predEndValue = Math.max(minV, lastDataValue - (lastDataValue - depleteValue) * (partialSpan / fullSpan));
  }
  const predEndY = ty(predEndValue);
  const predEndX = predT ? tx(predT) : null;
  const predLinePath = hasPred && predEndX
    ? `M ${lastPt.x} ${lastPt.y} L ${predEndX} ${predEndY}` : null;

  const nowX = tx(nowT);
  const nowInChart = nowX > PAD.left && nowX < PAD.left + pw;

  const lineColor = CHART_LINE_COLOR[status];
  const gradId = `ltArea-${chartId}`;

  const yTicks = [0, 0.5, 1].map((f) => {
    const v = minV + f * rangeV;
    return { y: ty(v), label: v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0) };
  });
  const xTicks = [0, 0.5, 1].map((f) => {
    const t = minT + f * rangeT;
    const d = new Date(t);
    return { x: tx(t), label: `${d.getMonth() + 1}/${d.getDate()}` };
  });

  const hasTopup = validLogs.some((l) => l.isTopup);

  return (
    <div style={{ margin: "8px 0" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lineColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yTicks.map((t, i) => (
          <line key={i} x1={PAD.left} y1={t.y} x2={PAD.left + pw} y2={t.y}
            stroke="var(--lt-track)" strokeWidth="1" />
        ))}
        {yTicks.map((t, i) => (
          <text key={i} x={PAD.left - 6} y={t.y + 4} textAnchor="end"
            fontSize="9" fill="var(--lt-ink-4)">
            {t.label}{i === 1 ? ` ${unit}` : ""}
          </text>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={H - 8} textAnchor="middle"
            fontSize="9" fill="var(--lt-ink-4)">{t.label}</text>
        ))}
        {hasPred && predEndX && (
          <rect
            x={Math.min(lastPt.x, nowX)} y={PAD.top}
            width={predEndX - Math.min(lastPt.x, nowX)}
            height={ph}
            fill="oklch(60% 0.060 260)" opacity="0.06"
          />
        )}
        <path d={areaPath} fill={`url(#${gradId})`} />
        {nowInChart && (
          <line x1={nowX} y1={PAD.top} x2={nowX} y2={PAD.top + ph}
            stroke="var(--lt-ink-4)" strokeWidth="1"
            strokeDasharray="3 3" opacity="0.5" />
        )}
        {predLinePath && (
          <path d={predLinePath} fill="none"
            stroke="oklch(60% 0.060 260)" strokeWidth="1.5"
            strokeDasharray="4 3" opacity="0.75" />
        )}
        <path d={linePath} fill="none"
          stroke={lineColor} strokeWidth="2.2"
          strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y}
            r={p.topup ? 5 : 3.5}
            fill={p.topup ? lineColor : "var(--lt-surface)"}
            stroke={lineColor} strokeWidth="2" />
        ))}
        {hasPred && predEndX && (
          <circle cx={predEndX} cy={predEndY} r={3}
            fill="var(--lt-surface)"
            stroke="oklch(60% 0.060 260)" strokeWidth="1.5" />
        )}
        <text x={lastPt.x + 6} y={lastPt.y - 6}
          fontSize="10" fontWeight="700" fill={lineColor}>
          {lastLog.value}
        </text>
      </svg>
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--lt-ink-4)" }}>
          <LegendDot color={lineColor} />实际示数
        </div>
        {hasTopup && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--lt-ink-4)" }}>
            <LegendDot color={lineColor} filled />补充
          </div>
        )}
        {hasPred && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--lt-ink-4)" }}>
            <LegendDash color="oklch(60% 0.060 260)" dashed />
            {predTruncated ? `预测（共 ${estimatedDays} 天）` : "预测"}
          </div>
        )}
        {nowInChart && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--lt-ink-4)" }}>
            <LegendDash color="var(--lt-ink-4)" dashed />当前
          </div>
        )}
      </div>
    </div>
  );
}

// ── DeadlineCard ──────────────────────────────────────────────────────────────

function buildDeadlineHistory(item: DeadlineItemDTO, renewals: DeadlineRenewal[]): DeadlineHistoryEntry[] {
  const sortedAsc = [...renewals].sort(
    (a, b) => new Date(a.renewedAt).getTime() - new Date(b.renewedAt).getTime()
  );

  if (sortedAsc.length === 0) {
    return [{
      id: `initial-${item.id}`,
      kind: "initial",
      rangeStartDate: item.startDate,
      rangeEndDate: item.expireDate,
      renewedAt: null,
      notes: null,
    }];
  }

  const first = sortedAsc[0];
  const initialStart = first.oldStartDate;
  // Legacy renewal rows created before old_start_date/new_start_date existed
  // cannot tell whether the original start date was empty or simply not recorded.
  const firstIsLegacyRenewal = !first.oldStartDate && !first.newStartDate;
  const entries: DeadlineHistoryEntry[] = [{
    id: `initial-${item.id}`,
    kind: "initial",
    rangeStartDate: initialStart,
    rangeStartMissingLabel: firstIsLegacyRenewal ? "未记录" : "未填写",
    rangeEndDate: first.oldExpireDate,
    renewedAt: null,
    notes: null,
  }];

  sortedAsc.forEach((r, index) => {
    const previous = sortedAsc[index - 1];
    const previousStart =
      r.oldStartDate ??
      previous?.newStartDate ??
      previous?.oldExpireDate ??
      initialStart;
    const currentStart = r.newStartDate ?? r.oldExpireDate;

    entries.push({
      id: `renewal-${r.id}`,
      kind: "renewal",
      rangeStartDate: currentStart,
      rangeEndDate: r.newExpireDate,
      previousRangeStartDate: previousStart,
      previousRangeStartMissingLabel: !r.oldStartDate && !r.newStartDate ? "未记录" : "未填写",
      previousRangeEndDate: r.oldExpireDate,
      renewedAt: r.renewedAt,
      notes: r.notes,
    });
  });

  return entries.reverse();
}

function DeadlineCard({
  item, onRenew, onEdit, onArchive, onDelete, onTagClick, onLoadRenewals,
  expanded, onToggleHistory,
}: {
  item: DeadlineItemDTO;
  onRenew: (item: DeadlineItemDTO) => void;
  onEdit: (item: DeadlineItemDTO) => void;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  onTagClick: (tag: string) => void;
  expanded: boolean;
  onToggleHistory: (id: number) => void;
  /** Optional override: return renewals from in-memory store (demo mode) */
  onLoadRenewals?: (id: number) => Promise<DeadlineRenewal[]>;
}) {
  const [renewals, setRenewals] = useState<DeadlineRenewal[]>([]);
  const [renewalsLoaded, setRenewalsLoaded] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  const actionsVisible = hovered || pinned || expanded;
  const overdueDays = item.daysLeft < 0 ? Math.abs(item.daysLeft) : 0;
  const historyEntries = buildDeadlineHistory(item, renewals);

  const toggleHistory = async () => {
    onToggleHistory(item.id);
    if (!expanded && !renewalsLoaded) {
      setLoadingHistory(true);
      try {
        if (onLoadRenewals) {
          setRenewals(await onLoadRenewals(item.id));
        } else {
          const res = await fetch(`/api/items/${item.id}/renewals`);
          if (res.ok) setRenewals(await res.json());
        }
        setRenewalsLoaded(true);
      } finally { setLoadingHistory(false); }
    }
  };

  return (
    <div className="lt-card"
      data-status={item.status}
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
        <DayBadge daysLeft={item.daysLeft} status={item.status} pct={item.drainPct} />
      </div>

      <DrainBar pct={item.drainPct} status={item.status} />

      {expanded && (
        <HistoryPanel>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--lt-ink-4)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "2px" }}>
            历史记录
          </div>
          {loadingHistory && <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>加载中…</div>}
          {!loadingHistory && historyEntries.map((entry) => (
            <div key={entry.id} style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "12px",
              alignItems: "start",
              padding: "9px 0",
              borderBottom: "1px solid var(--lt-border-muted)",
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--lt-ink-2)" }}>
                  {fmtDateRange(entry.rangeStartDate, entry.rangeEndDate, entry.rangeStartMissingLabel)}
                </div>
                <div style={{ fontSize: "11px", color: "var(--lt-ink-4)", marginTop: "3px" }}>
                  {entry.kind === "initial"
                    ? "初始时间范围"
                    : `由 ${fmtDateRange(
                        entry.previousRangeStartDate,
                        entry.previousRangeEndDate ?? entry.rangeEndDate,
                        entry.previousRangeStartMissingLabel
                      )} 续期而来`}
                </div>
                {entry.notes && <div style={{ fontSize: "12px", color: "var(--lt-ink-4)", marginTop: "3px" }}>{entry.notes}</div>}
              </div>
              <div style={{ fontSize: "11px", color: "var(--lt-ink-4)", flexShrink: 0, marginLeft: "12px" }}>
                {entry.renewedAt ? fmtFullDate(entry.renewedAt) : "初始"}
              </div>
            </div>
          ))}
        </HistoryPanel>
      )}

      <CardActions visible={actionsVisible}>
        <ActionBtn
          icon={expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          label={`历史记录${renewalsLoaded ? ` (${historyEntries.length})` : ""}`}
          onClick={toggleHistory}
        />
        <div style={{ flex: 1 }} />
        <ActionBtn icon={<Pencil size={12} />} label="编辑" onClick={() => onEdit(item)} />
        <ActionBtn icon={<RotateCcw size={12} />} label="续期" onClick={() => onRenew(item)} />
        <OverflowMenu onArchive={() => onArchive(item.id)} onDelete={() => onDelete(item.id)} />
      </CardActions>
    </div>
  );
}

// ── ConsumptionCard ───────────────────────────────────────────────────────────

function ConsumptionCard({
  item, onAddLog, onEdit, onArchive, onDelete, onTagClick,
  onLoadLogs, onPatchLog, onDeleteLog, expanded, onToggleHistory,
}: {
  item: ConsumptionItemDTO;
  onAddLog: (item: ConsumptionItemDTO) => void;
  onEdit: (item: ConsumptionItemDTO) => void;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  onTagClick: (tag: string) => void;
  expanded: boolean;
  onToggleHistory: (id: number) => void;
  /** Optional overrides for demo mode — replace internal fetch calls */
  onLoadLogs?: (id: number) => Promise<ConsumptionLog[]>;
  onPatchLog?: (itemId: number, logId: number, patch: PatchLogBody) => Promise<void>;
  onDeleteLog?: (itemId: number, logId: number) => Promise<void>;
}) {
  const hasData = item.logCount >= 2;
  const depletionDate = hasData && item.estimatedDays > 0
    ? new Date(Date.now() + item.estimatedDays * 86_400_000)
        .toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })
    : null;

  const [logs, setLogs] = useState<ConsumptionLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [logDeleteTarget, setLogDeleteTarget] = useState<number | null>(null);
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editLogValue, setEditLogValue] = useState("");
  const [editLogNotes, setEditLogNotes] = useState("");
  const [savingLog, setSavingLog] = useState(false);
  const [chartView, setChartView] = useState<"none" | "trend" | "heatmap">("none");
  const [timeRange, setTimeRange] = useState<ChartRange>("all");

  const actionsVisible = hovered || pinned || expanded;

  const loadLogs = async () => {
    setLoadingHistory(true);
    try {
      if (onLoadLogs) {
        setLogs(await onLoadLogs(item.id));
      } else {
        const res = await fetch(`/api/items/${item.id}/logs`);
        if (res.ok) setLogs(await res.json());
      }
    } finally { setLoadingHistory(false); }
  };

  const toggleHistory = async () => {
    onToggleHistory(item.id);
    if (!expanded) await loadLogs();
  };

  const startEditLog = (log: ConsumptionLog) => {
    setEditingLogId(log.id);
    setEditLogValue(String(log.value));
    setEditLogNotes(log.notes ?? "");
  };

  const saveEditLog = async (log: ConsumptionLog) => {
    const val = parseFloat(editLogValue);
    if (isNaN(val)) return;
    setSavingLog(true);
    try {
      if (onPatchLog) {
        await onPatchLog(item.id, log.id, { value: val, notes: editLogNotes || undefined });
      } else {
        await fetch(`/api/items/${item.id}/logs/${log.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: val, notes: editLogNotes || undefined }),
        });
      }
      setEditingLogId(null);
      await loadLogs();
    } finally { setSavingLog(false); }
  };

  const toggleAnomaly = async (log: ConsumptionLog) => {
    if (onPatchLog) {
      await onPatchLog(item.id, log.id, { isAnomaly: !log.isAnomaly });
    } else {
      await fetch(`/api/items/${item.id}/logs/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAnomaly: !log.isAnomaly }),
      });
    }
    await loadLogs();
  };

  const deleteLog = async (logId: number) => {
    if (onDeleteLog) {
      await onDeleteLog(item.id, logId);
    } else {
      await fetch(`/api/items/${item.id}/logs/${logId}`, { method: "DELETE" });
    }
    setLogDeleteTarget(null);
    await loadLogs();
  };

  return (
    <div className="lt-card"
      data-status={item.status}
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
            {item.logCount > 0 && (
              <span> · 更新于 {item.lastRecordedDaysAgo === 0 ? "今天" : `${item.lastRecordedDaysAgo} 天前`}</span>
            )}
          </div>
        </div>
        {hasData && <DayBadge daysLeft={item.estimatedDays} status={item.status} pct={item.drainPct} />}
      </div>

      {item.logCount === 0 && (
        <div className="lt-cold-start">
          <LayoutGrid size={26} strokeWidth={1.5} />
          <span style={{ fontSize: "14px", fontWeight: 600 }}>暂无数据</span>
          <span style={{ fontSize: "12px", textAlign: "center", lineHeight: 1.5 }}>
            录入第一条示数开始追踪
          </span>
        </div>
      )}

      {item.logCount === 1 && (
        <div style={{ background: "var(--lt-surface-2)", borderRadius: "12px", padding: "14px" }}>
          <div style={{ fontSize: "11px", color: "var(--lt-ink-4)", fontWeight: 500, marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "18px", height: "18px", borderRadius: "9999px",
              background: BAR_COLOR.warning, fontSize: "10px", fontWeight: 700, color: "var(--lt-ink-1)",
            }}>1</span>
            已录入 1 条，再录入 1 次即可开始预估
          </div>
          <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
            <div style={{ height: "4px", flex: 1, borderRadius: "9999px", background: BAR_COLOR.ok }} />
            <div style={{ height: "4px", flex: 1, borderRadius: "9999px", background: "var(--lt-track)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
            <span style={{ fontSize: "26px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.02em" }}>
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
                <span style={{ fontSize: "12px", color: "var(--lt-ink-3)", marginLeft: "3px" }}>{item.unit}/天</span>
              </div>
            </div>
          </div>
          <DrainBar pct={item.drainPct} status={item.status} label="预计剩余比" />
          {depletionDate && (
            <div style={{ fontSize: "12px", color: "var(--lt-ink-4)", textAlign: "right", marginTop: "2px" }}>
              预计耗尽：<span style={{ fontWeight: 600, color: "var(--lt-ink-3)" }}>{depletionDate}</span>
            </div>
          )}
        </>
      )}

      {expanded && (
        <HistoryPanel>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--lt-ink-4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              示数记录
            </div>
            {logs.length >= 2 && (
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => setChartView((v) => v === "trend" ? "none" : "trend")}
                  style={{
                    fontSize: "11px", fontWeight: 600, color: "var(--lt-ink-3)",
                    background: chartView === "trend" ? "var(--lt-surface-2)" : "transparent",
                    border: "none", borderRadius: "6px", padding: "2px 8px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "4px",
                  }}
                >
                  <TrendingDown size={11} />趋势
                </button>
                <button
                  onClick={() => setChartView((v) => v === "heatmap" ? "none" : "heatmap")}
                  style={{
                    fontSize: "11px", fontWeight: 600, color: "var(--lt-ink-3)",
                    background: chartView === "heatmap" ? "var(--lt-surface-2)" : "transparent",
                    border: "none", borderRadius: "6px", padding: "2px 8px", cursor: "pointer",
                  }}
                >
                  热力图
                </button>
              </div>
            )}
          </div>

          {chartView === "trend" && logs.length >= 2 && (
            <>
              <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                {(["30", "90", "all"] as ChartRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    style={{
                      fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "6px",
                      border: "none", cursor: "pointer",
                      background: timeRange === r ? "var(--lt-ink-1)" : "var(--lt-track)",
                      color: timeRange === r ? "var(--lt-on-ink)" : "var(--lt-ink-3)",
                      transition: "background 120ms ease-out",
                    }}
                  >
                    {r === "all" ? "全部" : `近${r}天`}
                  </button>
                ))}
              </div>
              <ConsumptionChart
                logs={logs} unit={item.unit}
                estimatedDays={item.estimatedDays}
                status={item.status}
                chartId={String(item.id)}
                timeRange={timeRange}
              />
            </>
          )}

          {chartView === "heatmap" && logs.length >= 2 && (
            <ConsumptionHeatmap
              logs={logs}
              unit={item.unit}
              status={item.status}
            />
          )}

          {loadingHistory && <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>加载中…</div>}
          {!loadingHistory && logs.length === 0 && (
            <div style={{ fontSize: "13px", color: "var(--lt-ink-4)" }}>暂无示数记录</div>
          )}

          {logs.map((log) => (
            <div key={log.id} style={{
              padding: "8px 0",
              borderBottom: "1px solid var(--lt-border-muted)",
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
                        background: "var(--lt-surface)", color: "var(--lt-ink-1)", outline: "none",
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
                        background: "var(--lt-surface)", color: "var(--lt-ink-1)", outline: "none",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button onClick={() => setEditingLogId(null)} className="lt-btn lt-btn-ghost" style={{ padding: "3px 10px", fontSize: "12px", height: "auto" }}>取消</button>
                    <button onClick={() => saveEditLog(log)} disabled={savingLog} className="lt-btn lt-btn-primary" style={{ padding: "3px 10px", fontSize: "12px", height: "auto" }}>
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
                          fontSize: "10px", fontWeight: 700, color: "var(--lt-ok-deep)",
                          background: "var(--lt-tag-bg)", padding: "1px 6px", borderRadius: "9999px",
                        }}>充值</span>
                      )}
                      {log.isAnomaly && (
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--lt-danger)", display: "flex", alignItems: "center", gap: "2px" }}>
                          <AlertCircle size={10} />异常
                        </span>
                      )}
                    </div>
                    {log.notes && <div style={{ fontSize: "11px", color: "var(--lt-ink-4)" }}>{log.notes}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, marginLeft: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--lt-ink-4)" }}>{fmtDate(log.recordedAt)}</div>
                    <button title="编辑" onClick={() => startEditLog(log)} style={{
                      padding: "3px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "var(--lt-ink-4)", cursor: "pointer", display: "flex", alignItems: "center",
                    }}>
                      <Pencil size={11} />
                    </button>
                    <button
                      title={log.isAnomaly ? "取消标记异常" : "标记为异常"}
                      onClick={() => toggleAnomaly(log)}
                      style={{
                        padding: "3px 6px", borderRadius: "6px", border: "none",
                        background: log.isAnomaly ? "var(--lt-danger-hover-bg)" : "transparent",
                        color: log.isAnomaly ? "var(--lt-danger)" : "var(--lt-ink-4)",
                        cursor: "pointer", fontSize: "11px", fontWeight: 600,
                      }}
                    >
                      {log.isAnomaly ? "恢复" : "异常"}
                    </button>
                    <button title="删除此条记录" onClick={() => setLogDeleteTarget(log.id)} style={{
                      padding: "3px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "var(--lt-ink-4)", cursor: "pointer", display: "flex", alignItems: "center",
                    }}>
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
        <ActionBtn icon={<PlusCircle size={12} />} label="录入" onClick={() => onAddLog(item)} />
        <OverflowMenu onArchive={() => onArchive(item.id)} onDelete={() => onDelete(item.id)} />
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

function AddModal({
  open, onClose, onSaved, onSaveOverride,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Demo mode: replace the fetch call with this handler */
  onSaveOverride?: (body: CreateItemBody) => Promise<void>;
}) {
  const [type, setType] = useState<AddType>("deadline");
  const [name, setName] = useState("");
  const [expireDate, setExpireDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [unit, setUnit] = useState("");
  const [alertDays, setAlertDays] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName(""); setExpireDate(""); setStartDate(""); setUnit("");
    setAlertDays(""); setTags([]); setNotes(""); setError("");
  };
  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (!name.trim()) { setError("名称不能为空"); return; }
    if (type === "deadline" && !expireDate) { setError("请选择结束日期"); return; }
    if (type === "consumption" && !unit.trim()) { setError("请填写单位"); return; }

    setSaving(true); setError("");
    try {
      const body: CreateItemBody = type === "deadline"
        ? { type: "deadline", name: name.trim(), expireDate,
            startDate: startDate || undefined,
            alertDays: alertDays ? Number(alertDays) : 30,
            tags, notes: notes || undefined }
        : { type: "consumption", name: name.trim(), unit: unit.trim(),
            alertDays: alertDays ? Number(alertDays) : 7,
            tags, notes: notes || undefined };

      if (onSaveOverride) {
        await onSaveOverride(body);
        reset(); onClose(); onSaved();
        return;
      }

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "保存失败"); return; }
      reset(); onClose(); onSaved();
    } finally { setSaving(false); }
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

          {type === "deadline" ? (
            <>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--lt-ink-4)", letterSpacing: "0.04em" }}>
                时间范围
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="lt-field">
                  <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>开始日期（可选）</label>
                  <input className="lt-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="lt-field">
                  <label className="lt-label">结束日期</label>
                  <input className="lt-input" type="date" value={expireDate} onChange={(e) => setExpireDate(e.target.value)} />
                </div>
              </div>
              <div className="lt-field">
                <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>提前提醒天数</label>
                <input className="lt-input" type="number" value={alertDays} onChange={(e) => setAlertDays(e.target.value)}
                  placeholder="默认 30 天" min="1" max="365" />
              </div>
            </>
          ) : (
            <>
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
            </>
          )}

          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>标签（可选）</label>
            <TagInput tags={tags} onChange={setTags} placeholder="输入后按回车添加" />
          </div>
          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>备注（可选）</label>
            <textarea className="lt-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <div style={{ fontSize: "13px", color: "var(--lt-danger)", fontWeight: 500 }}>{error}</div>}
        </div>

        <div className="lt-modal-footer">
          <button className="lt-btn lt-btn-ghost" onClick={handleClose} disabled={saving}>取消</button>
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
  item, onClose, onSaved, onSaveOverride,
}: {
  item: DeadlineItemDTO | ConsumptionItemDTO | null;
  onClose: () => void;
  onSaved: () => void;
  onSaveOverride?: (id: number, patch: PatchItemBody) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [alertDays, setAlertDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item) {
      setName(item.name);
      setNotes(item.notes ?? "");
      setTags([...item.tags]);
      setAlertDays(String(item.alertDays));
      setError("");
    }
  }, [item]);

  const handleSave = async () => {
    if (!name.trim()) { setError("名称不能为空"); return; }
    if (!item) return;
    setSaving(true); setError("");
    try {
      const patch: PatchItemBody = {
        name: name.trim(), notes: notes || undefined,
        tags, alertDays: alertDays ? Number(alertDays) : undefined,
      };

      if (onSaveOverride) {
        await onSaveOverride(item.id, patch);
        onClose(); onSaved();
        return;
      }

      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "保存失败"); return; }
      onClose(); onSaved();
    } finally { setSaving(false); }
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
            <TagInput tags={tags} onChange={setTags} placeholder="输入后按回车添加" />
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
          <AlertTriangle size={22} style={{ color: "var(--lt-danger)" }} strokeWidth={2} />
        </div>

        <DialogHeader style={{ marginBottom: "8px", textAlign: "center" }}>
          <DialogTitle style={{ fontSize: "17px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.01em", textAlign: "center" }}>
            删除「{target?.name}」
          </DialogTitle>
        </DialogHeader>

        <p style={{ fontSize: "14px", color: "var(--lt-ink-3)", textAlign: "center", lineHeight: 1.5, margin: "0 0 24px" }}>
          删除后数据无法恢复，包括所有历史记录。
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button onClick={handleConfirm} disabled={deleting} style={{
            height: "44px", borderRadius: "12px", border: "none",
            background: "var(--lt-danger)", color: "#fff",
            fontSize: "14px", fontWeight: 700, cursor: "pointer",
            opacity: deleting ? 0.6 : 1, transition: "opacity 150ms ease-out",
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

// ── RenewModal ────────────────────────────────────────────────────────────────

function RenewModal({
  item, onClose, onSaved, onSaveOverride,
}: {
  item: DeadlineItemDTO | null;
  onClose: () => void;
  onSaved: () => void;
  onSaveOverride?: (id: number, body: RenewBody) => Promise<void>;
}) {
  const [newExpireDate, setNewExpireDate] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (item) { setNewStartDate(item.expireDate); setNewExpireDate(""); setNotes(""); setError(""); }
  }, [item]);

  const handleSave = async () => {
    if (!newExpireDate) { setError("请选择新结束日期"); return; }
    if (!item) return;
    setSaving(true); setError("");
    try {
      const body: RenewBody = {
        newExpireDate,
        newStartDate: newStartDate || item.expireDate,
        notes: notes || undefined,
      };

      if (onSaveOverride) {
        await onSaveOverride(item.id, body);
        onClose(); onSaved();
        return;
      }

      const res = await fetch(`/api/items/${item.id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "续期失败"); return; }
      onClose(); onSaved();
    } finally { setSaving(false); }
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
          <div style={{ background: "var(--lt-surface-2)", borderRadius: "12px", padding: "10px 14px", fontSize: "13px", color: "var(--lt-ink-3)" }}>
            当前时间范围：<span style={{ fontWeight: 600, color: "var(--lt-ink-2)" }}>
              {item ? fmtDateRange(item.startDate, item.expireDate) : ""}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="lt-field">
              <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>新开始日期</label>
              <input className="lt-input" type="date" value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)} />
            </div>
            <div className="lt-field">
              <label className="lt-label">新结束日期</label>
              <input className="lt-input" type="date" value={newExpireDate}
                onChange={(e) => setNewExpireDate(e.target.value)} />
            </div>
          </div>

          <div className="lt-field">
            <label className="lt-label" style={{ color: "var(--lt-ink-3)" }}>备注（可选）</label>
            <textarea className="lt-textarea" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="如：续费 1 年" style={{ minHeight: "56px" }} />
          </div>

          {error && <div style={{ fontSize: "13px", color: "var(--lt-danger)", fontWeight: 500 }}>{error}</div>}
        </div>

        <div className="lt-modal-footer">
          <button className="lt-btn lt-btn-ghost" onClick={onClose} disabled={saving}>取消</button>
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
  item, onClose, onSaved, onSaveOverride,
}: {
  item: ConsumptionItemDTO | null;
  onClose: () => void;
  onSaved: () => void;
  onSaveOverride?: (itemId: number, body: CreateLogBody) => Promise<void>;
}) {
  const todayLocal = new Date().toLocaleDateString("sv-SE");
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
    setSaving(true); setError("");
    try {
      const body: CreateLogBody = {
        value: num,
        recordedAt: new Date(recordedAt).toISOString(),
        notes: notes || undefined,
      };

      if (onSaveOverride) {
        await onSaveOverride(item.id, body);
        onClose(); onSaved();
        return;
      }

      const res = await fetch(`/api/items/${item.id}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "录入失败"); return; }
      onClose(); onSaved();
    } finally { setSaving(false); }
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
            <input className="lt-input" type="number" step="0.01" value={value}
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
          <button className="lt-btn lt-btn-ghost" onClick={onClose} disabled={saving}>取消</button>
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
  const Icon = isSearch ? Search : tab === "deadline" ? Timer : Gauge;
  return (
    <div style={{ textAlign: "center", padding: "72px 24px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px", color: "var(--lt-ink-4)", opacity: 0.5 }}>
        <Icon size={40} strokeWidth={1.4} />
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

// ── Push helpers ──────────────────────────────────────────────────────────────

/**
 * Convert a base64url-encoded VAPID public key to a Uint8Array.
 * The Web Push spec requires a BufferSource for applicationServerKey;
 * passing a raw string works in Chrome 67+ but fails in older/non-Chrome engines.
 */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const b64    = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw    = atob(b64);
  const arr    = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

// ── usePushSubscription ───────────────────────────────────────────────────────

function usePushSubscription(enabled: boolean) {
  const [subscribed,   setSubscribed]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [supported,    setSupported]    = useState(false);
  // True when on iOS Safari in browser mode (not installed as PWA)
  const [iosNeedsPWA,  setIosNeedsPWA]  = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    const isStandalone =
      (navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    // On iOS, Web Push only works from an installed PWA (Home Screen icon).
    // Show a hint instead of an unusable button when in browser mode.
    if (isIos && !isStandalone) {
      setIosNeedsPWA(true);
      return;
    }

    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, [enabled]);

  const toggle = useCallback(async () => {
    if (!supported || loading) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      if (subscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setSubscribed(false);
        return;
      }

      // Request permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;

      // Fetch VAPID public key
      const res = await fetch("/api/push/subscribe");
      const { enabled: pushEnabled, publicKey } = await res.json();
      if (!pushEnabled || !publicKey) return;

      // Subscribe — convert to Uint8Array for maximum browser compatibility
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      setSubscribed(true);
    } catch (e) {
      console.error("[push]", e);
    } finally {
      setLoading(false);
    }
  }, [supported, subscribed, loading]);

  return { subscribed, loading, supported, iosNeedsPWA, toggle };
}

// ── HomeContent ───────────────────────────────────────────────────────────────

export function HomeContent({ isDemo = false }: { isDemo?: boolean }) {
  // ── Auth (only used in real mode) ─────────────────────────────────────────
  const { data: session } = useSession();
  const user = isDemo ? null : session?.user;
  const isAdmin = user?.role === "admin";

  // ── Theme ─────────────────────────────────────────────────────────────────
  const { theme, toggle: toggleTheme } = useTheme();

  // ── Service Worker registration ───────────────────────────────────────────
  //
  // Skipped in development: sw.js cache-first's /_next/static/*, but dev-mode
  // chunk URLs are stable (not content-hashed like prod builds), so any local
  // code change gets silently masked by the old cached bundle until the SW is
  // manually unregistered. Production keeps full PWA/offline/push behavior.
  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) =>
        console.warn("[sw]", e)
      );
    }
  }, []);

  // ── Push subscription (only in authenticated, non-demo mode) ──────────────
  const { subscribed: pushSubscribed, loading: pushLoading, supported: pushSupported, iosNeedsPWA, toggle: togglePush }
    = usePushSubscription(!isDemo && !!user);

  // ── Core state ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("deadline");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState<DeadlineItemDTO | null>(null);
  const [logTarget, setLogTarget] = useState<ConsumptionItemDTO | null>(null);
  const [editTarget, setEditTarget] = useState<DeadlineItemDTO | ConsumptionItemDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [expandedCardKey, setExpandedCardKey] = useState<ExpandedCardKey>(null);
  const [deadlines, setDeadlines] = useState<DeadlineItemDTO[]>(() =>
    isDemo ? buildDemoDeadlines() : []
  );
  const [consumptions, setConsumptions] = useState<ConsumptionItemDTO[]>(() =>
    isDemo ? buildDemoConsumptions() : []
  );
  const [loading, setLoading] = useState(!isDemo);

  // ── Demo-only state (ignored in real mode) ────────────────────────────────
  const demoLogsRef = useRef<Map<number, ConsumptionLog[]>>(
    isDemo ? buildDemoLogs() : new Map()
  );
  const demoRenewalsRef = useRef<Map<number, DeadlineRenewal[]>>(new Map());
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (isDemo) {
      setDeadlines(buildDemoDeadlines());
      setConsumptions(buildDemoConsumptions());
      demoLogsRef.current = buildDemoLogs();
      demoRenewalsRef.current = new Map();
      forceUpdate();
      return;
    }
    setLoading(true);
    try {
      const [dl, cs] = await Promise.all([
        fetchItems<DeadlineItemDTO>("deadline"),
        fetchItems<ConsumptionItemDTO>("consumption"),
      ]);
      setDeadlines(dl);
      setConsumptions(cs);
    } finally { setLoading(false); }
  }, [isDemo]);

  useEffect(() => {
    if (!isDemo) load();
  }, [load, isDemo]);

  const toggleDeadlineHistory = useCallback((id: number) => {
    setExpandedCardKey((current) => current === `deadline:${id}` ? null : `deadline:${id}`);
  }, []);

  const toggleConsumptionHistory = useCallback((id: number) => {
    setExpandedCardKey((current) => current === `consumption:${id}` ? null : `consumption:${id}`);
  }, []);

  const switchTab = (next: Tab) => {
    setTab(next);
    setExpandedCardKey(null);
  };

  // ── Demo helpers ──────────────────────────────────────────────────────────

  /** Recalculates consumption DTO metrics from in-memory logs and updates state. */
  const demoRecalcConsumption = useCallback((itemId: number) => {
    const logs = demoLogsRef.current.get(itemId) ?? [];
    setConsumptions((prev) => {
      const item = prev.find((c) => c.id === itemId);
      if (!item) return prev;
      const logRows: LogRow[] = logs.map((l) => ({
        recorded_at: l.recordedAt,
        value: l.value,
        is_topup: l.isTopup,
        is_anomaly: l.isAnomaly,
      }));
      const sorted = [...logRows].sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      );
      const est = calcConsumptionEstimate(sorted, item.alertDays);
      const lastLog = sorted[sorted.length - 1];
      return prev.map((c) => c.id === itemId ? {
        ...c,
        logCount: logs.length,
        lastRecordedAt: lastLog?.recorded_at ?? null,
        lastRecordedValue: lastLog?.value ?? null,
        lastRecordedDaysAgo: lastLog
          ? Math.floor((Date.now() - new Date(lastLog.recorded_at).getTime()) / 86_400_000) : 0,
        estimatedValue: parseFloat(est.estimatedValue.toFixed(2)),
        estimatedDays: est.estimatedDays,
        dailyRate: parseFloat(est.dailyRate.toFixed(4)),
        drainPct: est.drainPct,
        status: est.status,
      } : c);
    });
  }, []);

  // ── Real-mode handlers ────────────────────────────────────────────────────

  const handleDeleteConfirm = useCallback(async (id: number) => {
    if (isDemo) {
      setDeadlines((prev) => prev.filter((i) => i.id !== id));
      setConsumptions((prev) => prev.filter((i) => i.id !== id));
      setDeleteTarget(null);
      return;
    }
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load();
  }, [isDemo, load]);

  const handleArchive = useCallback(async (id: number) => {
    if (isDemo) {
      setDeadlines((prev) => prev.filter((i) => i.id !== id));
      setConsumptions((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    load();
  }, [isDemo, load]);

  // ── Demo operation overrides (undefined in real mode) ─────────────────────

  const demoOnSaveAdd = isDemo
    ? async (body: CreateItemBody) => {
        const id = nextDemoId();
        const now = new Date().toISOString();
        if (body.type === "deadline") {
          const metrics = calcDeadlineMetrics(
            body.expireDate, body.alertDays ?? 30, body.startDate ?? null
          );
          setDeadlines((prev) => [...prev, {
            id, type: "deadline", name: body.name,
            expireDate: body.expireDate,
            startDate: body.startDate ?? null,
            alertDays: body.alertDays ?? 30,
            notes: body.notes ?? null, tags: body.tags ?? [],
            ...metrics,
            archivedAt: null, createdAt: now, updatedAt: now,
          }]);
        } else {
          setConsumptions((prev) => [...prev, {
            id, type: "consumption", name: body.name,
            unit: body.unit, alertDays: body.alertDays ?? 7,
            notes: body.notes ?? null, tags: body.tags ?? [],
            logCount: 0, lastRecordedAt: null, lastRecordedDaysAgo: 0,
            lastRecordedValue: null, estimatedValue: 0, estimatedDays: 0,
            dailyRate: 0, drainPct: 0, status: "ok",
            archivedAt: null, createdAt: now, updatedAt: now,
          }]);
        }
      }
    : undefined;

  const demoOnSaveEdit = isDemo
    ? async (id: number, patch: PatchItemBody) => {
        const now = new Date().toISOString();
        setDeadlines((prev) => prev.map((i) =>
          i.id === id ? { ...i, ...patch, updatedAt: now } : i
        ));
        setConsumptions((prev) => prev.map((i) =>
          i.id === id ? { ...i, ...patch, updatedAt: now } : i
        ));
      }
    : undefined;

  const demoOnSaveRenew = isDemo
    ? async (id: number, body: RenewBody) => {
        const now = new Date().toISOString();
        setDeadlines((prev) => prev.map((item) => {
          if (item.id !== id) return item;
          const metrics = calcDeadlineMetrics(
            body.newExpireDate, item.alertDays, body.newStartDate ?? item.expireDate
          );
          // Record the renewal
          const renewals = demoRenewalsRef.current.get(id) ?? [];
          demoRenewalsRef.current.set(id, [{
            id: nextDemoId(), itemId: id, renewedAt: now,
            oldStartDate: item.startDate,
            oldExpireDate: item.expireDate,
            newStartDate: body.newStartDate ?? item.expireDate,
            newExpireDate: body.newExpireDate,
            notes: body.notes ?? null,
          }, ...renewals]);
          return {
            ...item,
            expireDate: body.newExpireDate,
            startDate: body.newStartDate ?? item.expireDate,
            ...metrics, updatedAt: now,
          };
        }));
      }
    : undefined;

  const demoOnSaveLog = isDemo
    ? async (itemId: number, body: CreateLogBody) => {
        const newLog: ConsumptionLog = {
          id: nextDemoId(), itemId,
          recordedAt: body.recordedAt,
          value: body.value,
          isTopup: false, isAnomaly: false,
          notes: body.notes ?? null,
        };
        const existing = demoLogsRef.current.get(itemId) ?? [];
        demoLogsRef.current.set(itemId, [...existing, newLog]);
        demoRecalcConsumption(itemId);
      }
    : undefined;

  const demoOnLoadRenewals = isDemo
    ? async (id: number) => demoRenewalsRef.current.get(id) ?? []
    : undefined;

  const demoOnLoadLogs = isDemo
    ? async (id: number) => demoLogsRef.current.get(id) ?? []
    : undefined;

  const demoOnPatchLog = isDemo
    ? async (itemId: number, logId: number, patch: PatchLogBody) => {
        const logs = demoLogsRef.current.get(itemId) ?? [];
        demoLogsRef.current.set(itemId, logs.map((l) =>
          l.id === logId ? { ...l, ...patch } : l
        ));
        demoRecalcConsumption(itemId);
      }
    : undefined;

  const demoOnDeleteLog = isDemo
    ? async (itemId: number, logId: number) => {
        const logs = demoLogsRef.current.get(itemId) ?? [];
        demoLogsRef.current.set(itemId, logs.filter((l) => l.id !== logId));
        demoRecalcConsumption(itemId);
      }
    : undefined;

  // ── Filtering / sorting ───────────────────────────────────────────────────

  const q = query.toLowerCase();
  const filteredDeadlines = deadlines
    .filter((i) => i.name.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q)))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const filteredConsumptions = consumptions
    .filter((i) => i.name.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q)))
    .sort((a, b) => {
      const aInsufficient = a.logCount < 2, bInsufficient = b.logCount < 2;
      if (aInsufficient !== bInsufficient) return aInsufficient ? 1 : -1;
      return a.estimatedDays - b.estimatedDays;
    });

  const currentItems = tab === "deadline" ? filteredDeadlines : filteredConsumptions;
  const isEmpty = currentItems.length === 0;

  const dlUrgent = deadlines.filter((i) => i.status === "danger" || i.status === "expired").length;
  const csUrgent = consumptions.filter((i) => i.status === "danger" || i.status === "expired").length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 20px" }}>

        {/* ── Demo Banner ── */}
        {isDemo && (
          <div style={{
            marginTop: "20px", padding: "10px 16px",
            background: "oklch(72% 0.16 265 / 0.10)",
            border: "1px solid oklch(72% 0.16 265 / 0.20)",
            borderRadius: "12px", fontSize: "13px", color: "var(--lt-ink-3)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
            flexWrap: "wrap",
          }}>
            <span>
              <span style={{ fontWeight: 700, color: "oklch(52% 0.16 265)" }}>演示模式</span>
              {" "}— 数据仅在当前页面有效，刷新即可恢复初始数据。
            </span>
            <Link href="/auth/login" style={{
              display: "flex", alignItems: "center", gap: "5px",
              fontSize: "12px", fontWeight: 700,
              color: "oklch(52% 0.16 265)", textDecoration: "none",
            }}>
              <LogIn size={13} /> 登录使用完整功能
            </Link>
          </div>
        )}

        {/* ── Page Header ── */}
        <div className="lt-home-header" style={{ padding: isDemo ? "28px 0 24px" : "32px 0 24px" }}>
          <div className="lt-home-header-row">
            <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--lt-ink-1)", letterSpacing: "-0.025em", lineHeight: 1.1, margin: 0 }}>
              Life Timer
            </h1>
            <div className="lt-home-header-actions">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
                style={{
                  flexShrink: 0,
                  width: "44px", height: "44px", borderRadius: "9999px",
                  background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--lt-ink-3)",
                  transition: "transform 120ms ease-out",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.07)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                {theme === "dark" ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
              </button>

              {/* Add item (primary action, always visible) */}
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  flexShrink: 0,
                  width: "44px", height: "44px", borderRadius: "9999px",
                  background: "var(--lt-fab-bg)", border: "none",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--lt-fab-color)",
                  boxShadow: "var(--lt-shadow-fab)",
                  transition: "transform 120ms ease-out, filter 120ms ease-out",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.07)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                aria-label="新增物品"
              >
                <Plus size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {!isDemo && (
            <div className="lt-home-header-row lt-home-header-row--secondary">
              {user ? (
                <div className="lt-user-badge">
                  <span className="lt-user-badge-name">{user.name}</span>
                  {isAdmin && (
                    <Link href="/admin/users" title="用户管理"
                      style={{ color: "var(--lt-ink-3)", display: "flex", alignItems: "center" }}>
                      <Settings size={13} strokeWidth={1.8} />
                    </Link>
                  )}
                  <button
                    className="lt-signout-btn"
                    onClick={() => signOut().then(() => (window.location.href = "/auth/login"))}
                    title="退出登录"
                  >
                    <LogOut size={12} strokeWidth={2} style={{ display: "inline", marginRight: "3px", verticalAlign: "middle" }} />
                    退出
                  </button>
                </div>
              ) : <div />}

              <div className="lt-home-header-actions">
                {/* Push notification toggle (authenticated + supported) */}
                {user && pushSupported && (
                  <button
                    onClick={togglePush}
                    disabled={pushLoading}
                    title={pushSubscribed ? "关闭推送通知" : "开启推送通知"}
                    style={{
                      flexShrink: 0,
                      width: "44px", height: "44px", borderRadius: "9999px",
                      background: pushSubscribed ? "var(--lt-ink-1)" : "var(--lt-surface)",
                      boxShadow: "var(--lt-card-shadow)",
                      border: "none", cursor: pushLoading ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: pushSubscribed ? "var(--lt-on-ink)" : "var(--lt-ink-3)",
                      opacity: pushLoading ? 0.6 : 1,
                      transition: "transform 120ms ease-out, background 180ms ease-out",
                    }}
                    onMouseEnter={(e) => { if (!pushLoading) e.currentTarget.style.transform = "scale(1.07)"; }}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    {pushSubscribed ? <Bell size={18} strokeWidth={1.8} /> : <BellOff size={18} strokeWidth={1.8} />}
                  </button>
                )}

                {/* Desktop: shown directly, plenty of room in the row */}
                {user && (
                  <Link href="/webhook" title="Webhook 通知" className="lt-header-inline-only" style={{
                    flexShrink: 0,
                    width: "44px", height: "44px", borderRadius: "9999px",
                    background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--lt-ink-3)", textDecoration: "none",
                    transition: "transform 120ms ease-out",
                  }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1.07)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "scale(1)")}
                  >
                    <Webhook size={18} strokeWidth={1.8} />
                  </Link>
                )}
                <Link href="/archived" title="已归档" className="lt-header-inline-only" style={{
                  flexShrink: 0,
                  width: "44px", height: "44px", borderRadius: "9999px",
                  background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--lt-ink-3)", textDecoration: "none",
                }}>
                  <Archive size={18} strokeWidth={1.8} />
                </Link>
                {user && iosNeedsPWA && (
                  <button
                    title="iOS 推送需要先添加到主屏幕 — 点击分享 → 添加到主屏幕"
                    className="lt-header-inline-only"
                    style={{
                      flexShrink: 0,
                      width: "44px", height: "44px", borderRadius: "9999px",
                      background: "var(--lt-surface)", boxShadow: "var(--lt-card-shadow)",
                      border: "1.5px dashed var(--lt-border)", cursor: "default",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--lt-ink-4)",
                    }}
                    onClick={() => alert("iOS 推送通知需要将 Life Timer 添加到主屏幕后才能使用。\n\n步骤：Safari → 底部分享按钮 → 添加到主屏幕 → 从主屏幕打开 App")}
                  >
                    <BellOff size={18} strokeWidth={1.5} />
                  </button>
                )}

                {/* Mobile: collapsed into one menu so the row never wraps */}
                <HeaderMenu>
                  {user && (
                    <Link href="/webhook" className="lt-header-menu-item">
                      <span className="lt-header-menu-item-icon"><Webhook size={15} strokeWidth={1.8} /></span>
                      Webhook 通知
                    </Link>
                  )}
                  <Link href="/archived" className="lt-header-menu-item">
                    <span className="lt-header-menu-item-icon"><Archive size={15} strokeWidth={1.8} /></span>
                    已归档
                  </Link>
                  {user && iosNeedsPWA && (
                    <button
                      type="button"
                      className="lt-header-menu-item"
                      onClick={() => alert("iOS 推送通知需要将 Life Timer 添加到主屏幕后才能使用。\n\n步骤：Safari → 底部分享按钮 → 添加到主屏幕 → 从主屏幕打开 App")}
                    >
                      <span className="lt-header-menu-item-icon"><BellOff size={15} strokeWidth={1.5} /></span>
                      添加到主屏幕启用推送
                    </button>
                  )}
                </HeaderMenu>
              </div>
            </div>
          )}
        </div>

        {/* ── Tab Bar ── */}
        <div className="lt-tabs" style={{ marginBottom: "16px" }}>
          <button className={`lt-tab${tab === "deadline" ? " active" : ""}`}
            onClick={() => switchTab("deadline")}>
            到期提醒
            {deadlines.length > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                marginLeft: "6px", minWidth: "18px", height: "18px",
                borderRadius: "9999px", fontSize: "11px", fontWeight: 700,
                padding: "0 5px",
                background: tab === "deadline"
                  ? (dlUrgent > 0 ? "var(--lt-tab-badge-active-urgent)" : "var(--lt-tab-badge-active)")
                  : (dlUrgent > 0 ? "var(--lt-tab-badge-inactive-urgent)" : "var(--lt-track)"),
                color: tab === "deadline"
                  ? "var(--lt-tab-active-color)"
                  : (dlUrgent > 0 ? "var(--lt-danger)" : "var(--lt-ink-3)"),
              }}>
                {deadlines.length}
              </span>
            )}
          </button>

          <button className={`lt-tab${tab === "consumption" ? " active" : ""}`}
            onClick={() => switchTab("consumption")}>
            消耗预估
            {consumptions.length > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                marginLeft: "6px", minWidth: "18px", height: "18px",
                borderRadius: "9999px", fontSize: "11px", fontWeight: 700,
                padding: "0 5px",
                background: tab === "consumption"
                  ? (csUrgent > 0 ? "var(--lt-tab-badge-active-urgent)" : "var(--lt-tab-badge-active)")
                  : (csUrgent > 0 ? "var(--lt-tab-badge-inactive-urgent)" : "var(--lt-track)"),
                color: tab === "consumption"
                  ? "var(--lt-tab-active-color)"
                  : (csUrgent > 0 ? "var(--lt-danger)" : "var(--lt-ink-3)"),
              }}>
                {consumptions.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Search ── */}
        <div className="lt-search-wrap" style={{ marginBottom: "16px" }}>
          <Search size={16} style={{
            position: "absolute", left: "15px", top: "50%",
            transform: "translateY(-50%)", color: "var(--lt-ink-4)", pointerEvents: "none",
          }} />
          <input className="lt-search-input"
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
          <div className="lt-card-list">
            {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Item List ── */}
        {!loading && (
          <>
            {!isEmpty && <StatusSummary items={currentItems} />}
            <div className="lt-card-list" style={{ paddingBottom: "80px" }}>
              {isEmpty ? (
                <div style={{ gridColumn: "1 / -1" }}>
                  <EmptyState isSearch={!!query} tab={tab} />
                </div>
              ) : tab === "deadline" ? (
                filteredDeadlines.map((item) => (
                  <DeadlineCard
                    key={item.id} item={item}
                    expanded={expandedCardKey === `deadline:${item.id}`}
                    onToggleHistory={toggleDeadlineHistory}
                    onRenew={setRenewTarget}
                    onEdit={setEditTarget}
                    onArchive={handleArchive}
                    onDelete={(id) => setDeleteTarget({ id, name: item.name })}
                    onTagClick={setQuery}
                    onLoadRenewals={demoOnLoadRenewals}
                  />
                ))
              ) : (
                filteredConsumptions.map((item) => (
                  <ConsumptionCard
                    key={item.id} item={item}
                    expanded={expandedCardKey === `consumption:${item.id}`}
                    onToggleHistory={toggleConsumptionHistory}
                    onAddLog={setLogTarget}
                    onEdit={setEditTarget}
                    onArchive={handleArchive}
                    onDelete={(id) => setDeleteTarget({ id, name: item.name })}
                    onTagClick={setQuery}
                    onLoadLogs={demoOnLoadLogs}
                    onPatchLog={demoOnPatchLog}
                    onDeleteLog={demoOnDeleteLog}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Mobile FAB ── */}
      <button className="lt-fab" onClick={() => setModalOpen(true)} aria-label="新增物品">
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <AddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={isDemo ? () => {} : load}
        onSaveOverride={demoOnSaveAdd}
      />
      <EditModal
        item={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={isDemo ? () => {} : load}
        onSaveOverride={demoOnSaveEdit}
      />
      <RenewModal
        item={renewTarget}
        onClose={() => setRenewTarget(null)}
        onSaved={isDemo ? () => {} : load}
        onSaveOverride={demoOnSaveRenew}
      />
      <LogModal
        item={logTarget}
        onClose={() => setLogTarget(null)}
        onSaved={isDemo ? () => {} : load}
        onSaveOverride={demoOnSaveLog}
      />
      <DeleteConfirmModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
