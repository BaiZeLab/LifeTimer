/**
 * Demo data — computed relative to "today" so the demo always looks fresh.
 * All metric fields are derived from the same algorithms used in production.
 */

import { calcDeadlineMetrics, calcConsumptionEstimate } from "./algorithms";
import type { LogRow } from "./algorithms";
import type { DeadlineItemDTO, ConsumptionItemDTO, ConsumptionLog } from "@/types/api";

// ── Date helpers ──────────────────────────────────────────────────────────────

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  return daysFromNow(-n);
}

const NOW_ISO = new Date().toISOString();

// ── Deadline items ─────────────────────────────────────────────────────────────

function makeDeadline(
  id: number,
  name: string,
  expireDays: number,      // relative to today; negative = already expired
  startedDaysAgo: number,  // how many days ago it started
  alertDays: number,
  tags: string[] = [],
  notes: string | null = null,
): DeadlineItemDTO {
  const expireDate = daysFromNow(expireDays);
  const startDate = daysAgo(startedDaysAgo);
  const metrics = calcDeadlineMetrics(expireDate, alertDays, startDate);
  return {
    id, type: "deadline", name, notes, tags,
    expireDate, startDate, alertDays,
    ...metrics,
    archivedAt: null, createdAt: NOW_ISO, updatedAt: NOW_ISO,
  };
}

// ── Consumption items ──────────────────────────────────────────────────────────

type RawLog = { daysAgoOffset: number; value: number; isTopup?: boolean };

function makeConsumption(
  id: number,
  name: string,
  unit: string,
  alertDays: number,
  rawLogs: RawLog[],
  tags: string[] = [],
  notes: string | null = null,
): ConsumptionItemDTO {
  const logs: LogRow[] = rawLogs.map((l) => ({
    recorded_at: daysAgo(l.daysAgoOffset),
    value: l.value,
    is_topup: l.isTopup ?? false,
    is_anomaly: false,
  }));

  const sorted = [...logs].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
  );

  const estimate = calcConsumptionEstimate(sorted, alertDays);
  const lastLog = sorted[sorted.length - 1] ?? null;
  const lastRecordedAt = lastLog?.recorded_at ?? null;
  const lastRecordedValue = lastLog?.value ?? null;
  const lastRecordedDaysAgo = lastRecordedAt
    ? Math.floor((Date.now() - new Date(lastRecordedAt).getTime()) / 86_400_000)
    : 0;

  return {
    id, type: "consumption", name, notes, tags, unit, alertDays,
    logCount: sorted.length,
    lastRecordedAt, lastRecordedDaysAgo, lastRecordedValue,
    estimatedValue: parseFloat(estimate.estimatedValue.toFixed(2)),
    estimatedDays: estimate.estimatedDays,
    dailyRate: parseFloat(estimate.dailyRate.toFixed(4)),
    drainPct: estimate.drainPct,
    status: estimate.status,
    archivedAt: null, createdAt: NOW_ISO, updatedAt: NOW_ISO,
  };
}

// ── Raw log seeds (must match makeConsumption args above) ─────────────────────

const WATER_LOGS: RawLog[]  = [
  { daysAgoOffset: 60, value: 128.5 },
  { daysAgoOffset: 45, value: 131.2 },
  { daysAgoOffset: 30, value: 134.1 },
  { daysAgoOffset: 15, value: 136.8 },
  { daysAgoOffset: 3,  value: 138.4 },
];

const ELEC_LOGS: RawLog[] = [
  { daysAgoOffset: 30, value: 4820 },
  { daysAgoOffset: 20, value: 4875 },
  { daysAgoOffset: 8,  value: 4940 },
];

// 净水滤芯：剩余寿命从 365 天衰减到 195 天（消耗速率 ≈ 1 天/天）
const FILTER_LOGS: RawLog[] = [
  { daysAgoOffset: 180, value: 365 },
  { daysAgoOffset: 10,  value: 195 },
];

// ── Build dataset ─────────────────────────────────────────────────────────────

export function buildDemoDeadlines(): DeadlineItemDTO[] {
  return [
    makeDeadline(1001, "VPS 服务器",      4,   330, 30,  ["服务器"],  "月付方案，按时续期"),
    makeDeadline(1002, "域名 example.com", 28,  337, 30,  ["域名"]),
    makeDeadline(1003, "驾驶证",           180, 1800, 30, ["证件"]),
    makeDeadline(1004, "SSL 证书",         -3,  362, 14,  ["服务器"], "已过期，需要立即更新"),
    makeDeadline(1005, "年费信用卡",        90,  275, 30,  ["财务"]),
  ];
}

export function buildDemoConsumptions(): ConsumptionItemDTO[] {
  return [
    makeConsumption(2001, "水表",     "m³", 14, WATER_LOGS,  ["家庭"]),
    makeConsumption(2002, "电表",     "度",  7, ELEC_LOGS,   ["家庭"], "夏季用量明显增加"),
    makeConsumption(2003, "净水滤芯", "天", 30, FILTER_LOGS, ["家庭"]),
  ];
}

/** Pre-populated ConsumptionLog records to seed the history panel. */
export function buildDemoLogs(): Map<number, ConsumptionLog[]> {
  let logId = 9000;
  const make = (itemId: number, raw: RawLog): ConsumptionLog => ({
    id: ++logId, itemId,
    recordedAt: daysAgo(raw.daysAgoOffset),
    value: raw.value,
    isTopup: raw.isTopup ?? false,
    isAnomaly: false,
    notes: null,
  });

  return new Map([
    [2001, WATER_LOGS.map((l) => make(2001, l))],
    [2002, ELEC_LOGS.map((l) => make(2002, l))],
    [2003, FILTER_LOGS.map((l) => make(2003, l))],
  ]);
}

// ── ID counter (for new items/logs added during demo) ─────────────────────────

let _nextId = 9100;
export function nextDemoId(): number {
  return ++_nextId;
}
