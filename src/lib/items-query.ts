import db from "./db";
import { calcDeadlineMetrics, calcConsumptionEstimate } from "./algorithms";
import { getItemTagNames } from "./tags";
import type { DeadlineItemDTO, ConsumptionItemDTO, ItemDTO, ConsumptionLog, DeadlineRenewal } from "@/types/api";

// ── Raw row types (SQLite returns 0/1 for booleans, strings for dates) ────────

interface ItemRow {
  id: number;
  name: string;
  type: "deadline" | "consumption";
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DeadlineRow extends ItemRow {
  expire_date: string;
  start_date: string | null;
  alert_days: number;
}

interface ConsumptionRow extends ItemRow {
  unit: string;
  alert_days: number;
}

interface LogRow {
  id: number;
  item_id: number;
  recorded_at: string;
  value: number;
  is_topup: number;
  is_anomaly: number;
  notes: string | null;
}

// ── Deadline ──────────────────────────────────────────────────────────────────

const DEADLINE_SELECT = `
  SELECT i.*, d.expire_date, d.start_date, d.alert_days
  FROM items i
  JOIN deadline_items d ON d.item_id = i.id
`;

function mapDeadline(row: DeadlineRow): DeadlineItemDTO {
  const metrics = calcDeadlineMetrics(row.expire_date, row.alert_days, row.start_date);
  return {
    id: row.id,
    type: "deadline",
    name: row.name,
    notes: row.notes,
    tags: getItemTagNames(row.id),
    expireDate: row.expire_date,
    startDate: row.start_date,
    alertDays: row.alert_days,
    ...metrics,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDeadlineItems(archivedOnly = false): DeadlineItemDTO[] {
  const where = archivedOnly
    ? "WHERE i.archived_at IS NOT NULL"
    : "WHERE i.archived_at IS NULL";
  const rows = db.prepare(`${DEADLINE_SELECT} ${where}`).all() as DeadlineRow[];
  return rows.map(mapDeadline);
}

export function getDeadlineItem(id: number): DeadlineItemDTO | null {
  const row = db.prepare(`${DEADLINE_SELECT} WHERE i.id = ?`).get(id) as DeadlineRow | undefined;
  return row ? mapDeadline(row) : null;
}

// ── Consumption ───────────────────────────────────────────────────────────────

const CONSUMPTION_SELECT = `
  SELECT i.*, c.unit, c.alert_days
  FROM items i
  JOIN consumption_items c ON c.item_id = i.id
`;

function mapConsumption(row: ConsumptionRow): ConsumptionItemDTO {
  const logs = db
    .prepare("SELECT * FROM consumption_logs WHERE item_id = ? ORDER BY recorded_at ASC")
    .all(row.id) as LogRow[];

  const logCount = logs.length;
  const lastLog = logs[logCount - 1] ?? null;
  const lastRecordedAt = lastLog?.recorded_at ?? null;
  const lastRecordedValue = lastLog?.value ?? null;
  const lastRecordedDaysAgo = lastRecordedAt
    ? Math.floor((Date.now() - new Date(lastRecordedAt).getTime()) / 86_400_000)
    : 0;

  const estimate = calcConsumptionEstimate(logs, row.alert_days);

  return {
    id: row.id,
    type: "consumption",
    name: row.name,
    notes: row.notes,
    tags: getItemTagNames(row.id),
    unit: row.unit,
    alertDays: row.alert_days,
    logCount,
    lastRecordedAt,
    lastRecordedDaysAgo,
    lastRecordedValue,
    estimatedValue: parseFloat(estimate.estimatedValue.toFixed(2)),
    estimatedDays: estimate.estimatedDays,
    dailyRate: parseFloat(estimate.dailyRate.toFixed(4)),
    drainPct: estimate.drainPct,
    status: estimate.status,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getConsumptionItems(archivedOnly = false): ConsumptionItemDTO[] {
  const where = archivedOnly
    ? "WHERE i.archived_at IS NOT NULL"
    : "WHERE i.archived_at IS NULL";
  const rows = db.prepare(`${CONSUMPTION_SELECT} ${where}`).all() as ConsumptionRow[];
  return rows.map(mapConsumption);
}

export function getConsumptionItem(id: number): ConsumptionItemDTO | null {
  const row = db.prepare(`${CONSUMPTION_SELECT} WHERE i.id = ?`).get(id) as ConsumptionRow | undefined;
  return row ? mapConsumption(row) : null;
}

// ── Mixed ─────────────────────────────────────────────────────────────────────

export function getItem(id: number): ItemDTO | null {
  const meta = db.prepare("SELECT type FROM items WHERE id = ?").get(id) as { type: string } | undefined;
  if (!meta) return null;
  return meta.type === "deadline" ? getDeadlineItem(id) : getConsumptionItem(id);
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export function getConsumptionLogs(itemId: number): ConsumptionLog[] {
  const rows = db
    .prepare("SELECT * FROM consumption_logs WHERE item_id = ? ORDER BY recorded_at DESC")
    .all(itemId) as LogRow[];
  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    recordedAt: r.recorded_at,
    value: r.value,
    isTopup: !!r.is_topup,
    isAnomaly: !!r.is_anomaly,
    notes: r.notes,
  }));
}

// ── Renewals ──────────────────────────────────────────────────────────────────

export function getDeadlineRenewals(itemId: number): DeadlineRenewal[] {
  const rows = db
    .prepare("SELECT * FROM deadline_renewals WHERE item_id = ? ORDER BY renewed_at DESC")
    .all(itemId) as {
      id: number; item_id: number; renewed_at: string;
      old_expire_date: string; new_expire_date: string; notes: string | null;
    }[];
  return rows.map((r) => ({
    id: r.id, itemId: r.item_id, renewedAt: r.renewed_at,
    oldExpireDate: r.old_expire_date, newExpireDate: r.new_expire_date, notes: r.notes,
  }));
}
