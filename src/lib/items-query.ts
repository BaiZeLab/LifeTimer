import sql from "./db";
import { calcDeadlineMetrics, calcConsumptionEstimate } from "./algorithms";
import type { DeadlineItemDTO, ConsumptionItemDTO, ItemDTO, ConsumptionLog, DeadlineRenewal } from "@/types/api";

// ── Raw row types ──────────────────────────────────────────────────────────

interface ItemRow {
  id: number;
  name: string;
  type: "deadline" | "consumption";
  notes: string | null;
  archived_at: string | null;
  user_id: string;
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
  is_topup: boolean;
  is_anomaly: boolean;
  notes: string | null;
}

// ── Batch helpers (eliminate N+1) ──────────────────────────────────────────

async function fetchTagsByItemIds(itemIds: number[]): Promise<Map<number, string[]>> {
  if (itemIds.length === 0) return new Map();
  const rows = await sql`
    SELECT it.item_id, t.name
    FROM tags t
    JOIN item_tags it ON it.tag_id = t.id
    WHERE it.item_id = ANY(${itemIds})
  ` as { item_id: number; name: string }[];

  const map = new Map<number, string[]>();
  for (const r of rows) {
    const arr = map.get(r.item_id) ?? [];
    arr.push(r.name);
    map.set(r.item_id, arr);
  }
  return map;
}

async function fetchLogsByItemIds(itemIds: number[]): Promise<Map<number, LogRow[]>> {
  if (itemIds.length === 0) return new Map();
  const rows = await sql`
    SELECT * FROM consumption_logs
    WHERE item_id = ANY(${itemIds})
    ORDER BY item_id, recorded_at ASC
  ` as LogRow[];

  const map = new Map<number, LogRow[]>();
  for (const r of rows) {
    const arr = map.get(r.item_id) ?? [];
    arr.push(r);
    map.set(r.item_id, arr);
  }
  return map;
}

// ── Deadline ──────────────────────────────────────────────────────────────

function mapDeadline(row: DeadlineRow, tags: string[]): DeadlineItemDTO {
  const metrics = calcDeadlineMetrics(row.expire_date, row.alert_days, row.start_date);
  return {
    id: row.id,
    type: "deadline",
    name: row.name,
    notes: row.notes,
    tags,
    expireDate: row.expire_date,
    startDate: row.start_date,
    alertDays: row.alert_days,
    ...metrics,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getDeadlineItems(userId: string, archivedOnly = false): Promise<DeadlineItemDTO[]> {
  const rows = await sql`
    SELECT i.*, d.expire_date, d.start_date, d.alert_days
    FROM items i
    JOIN deadline_items d ON d.item_id = i.id
    WHERE i.user_id = ${userId}
      AND ((${archivedOnly} AND i.archived_at IS NOT NULL)
        OR (NOT ${archivedOnly} AND i.archived_at IS NULL))
  ` as DeadlineRow[];

  const tagMap = await fetchTagsByItemIds(rows.map((r) => r.id));
  return rows.map((r) => mapDeadline(r, tagMap.get(r.id) ?? []));
}

export async function getDeadlineItem(id: number, userId: string): Promise<DeadlineItemDTO | null> {
  const rows = await sql`
    SELECT i.*, d.expire_date, d.start_date, d.alert_days
    FROM items i
    JOIN deadline_items d ON d.item_id = i.id
    WHERE i.id = ${id} AND i.user_id = ${userId}
  ` as DeadlineRow[];
  if (!rows[0]) return null;
  const tagMap = await fetchTagsByItemIds([id]);
  return mapDeadline(rows[0], tagMap.get(id) ?? []);
}

// ── Consumption ───────────────────────────────────────────────────────────

function mapConsumption(row: ConsumptionRow, tags: string[], logs: LogRow[]): ConsumptionItemDTO {
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
    tags,
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

export async function getConsumptionItems(userId: string, archivedOnly = false): Promise<ConsumptionItemDTO[]> {
  const rows = await sql`
    SELECT i.*, c.unit, c.alert_days
    FROM items i
    JOIN consumption_items c ON c.item_id = i.id
    WHERE i.user_id = ${userId}
      AND ((${archivedOnly} AND i.archived_at IS NOT NULL)
        OR (NOT ${archivedOnly} AND i.archived_at IS NULL))
  ` as ConsumptionRow[];

  const itemIds = rows.map((r) => r.id);
  const [tagMap, logMap] = await Promise.all([
    fetchTagsByItemIds(itemIds),
    fetchLogsByItemIds(itemIds),
  ]);

  return rows.map((r) => mapConsumption(r, tagMap.get(r.id) ?? [], logMap.get(r.id) ?? []));
}

export async function getConsumptionItem(id: number, userId: string): Promise<ConsumptionItemDTO | null> {
  const rows = await sql`
    SELECT i.*, c.unit, c.alert_days
    FROM items i
    JOIN consumption_items c ON c.item_id = i.id
    WHERE i.id = ${id} AND i.user_id = ${userId}
  ` as ConsumptionRow[];
  if (!rows[0]) return null;

  const [tagMap, logMap] = await Promise.all([
    fetchTagsByItemIds([id]),
    fetchLogsByItemIds([id]),
  ]);
  return mapConsumption(rows[0], tagMap.get(id) ?? [], logMap.get(id) ?? []);
}

// ── Mixed ─────────────────────────────────────────────────────────────────

export async function getItem(id: number, userId: string): Promise<ItemDTO | null> {
  const rows = await sql`SELECT type FROM items WHERE id = ${id} AND user_id = ${userId}` as { type: string }[];
  if (!rows[0]) return null;
  return rows[0].type === "deadline" ? getDeadlineItem(id, userId) : getConsumptionItem(id, userId);
}

// Ownership check only (no full DTO needed)
export async function getItemOwner(id: number): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM items WHERE id = ${id}` as { user_id: string }[];
  return rows[0]?.user_id ?? null;
}

// ── Logs ──────────────────────────────────────────────────────────────────

export async function getConsumptionLogs(itemId: number): Promise<ConsumptionLog[]> {
  const rows = await sql`
    SELECT * FROM consumption_logs WHERE item_id = ${itemId} ORDER BY recorded_at DESC
  ` as LogRow[];
  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    recordedAt: r.recorded_at,
    value: r.value,
    isTopup: r.is_topup,
    isAnomaly: r.is_anomaly,
    notes: r.notes,
  }));
}

// ── Renewals ──────────────────────────────────────────────────────────────

export async function getDeadlineRenewals(itemId: number): Promise<DeadlineRenewal[]> {
  const rows = await sql`
    SELECT * FROM deadline_renewals WHERE item_id = ${itemId} ORDER BY renewed_at DESC
  ` as {
    id: number; item_id: number; renewed_at: string;
    old_start_date: string | null; old_expire_date: string;
    new_start_date: string | null; new_expire_date: string; notes: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id, itemId: r.item_id, renewedAt: r.renewed_at,
    oldStartDate: r.old_start_date,
    oldExpireDate: r.old_expire_date,
    newStartDate: r.new_start_date,
    newExpireDate: r.new_expire_date,
    notes: r.notes,
  }));
}
