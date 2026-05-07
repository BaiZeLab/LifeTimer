import type { ItemStatus } from "@/types/api";

export interface LogRow {
  recorded_at: string;
  value: number;
  is_topup: boolean | number;
  is_anomaly: boolean | number;
}

export interface ConsumptionEstimate {
  dailyRate: number;
  estimatedValue: number;
  estimatedDays: number;
  drainPct: number;
  status: ItemStatus;
}

/**
 * Calculate weighted average daily consumption rate and derived metrics.
 *
 * Algorithm:
 * 1. Sort and filter anomaly logs.
 * 2. For each consecutive pair of logs, compute the interval consumption rate.
 *    Pairs that cross a topup (value increases) are skipped.
 * 3. Weight each interval by two factors multiplied together:
 *    - Time decay: exp(-λ × days_since_interval_end), half-life = RATE_HALF_LIFE_DAYS.
 *      More recent intervals matter more.
 *    - Interval length: min(interval_days, MAX_INTERVAL_WEIGHT_DAYS).
 *      Longer intervals are more statistically reliable; single-day spikes
 *      are naturally down-weighted compared to multi-day intervals.
 * 4. Project current estimated value from last log.
 * 5. Estimate days remaining.
 */

/** Half-life for time-decay weighting (days). Data ~4 weeks old has half the influence. */
const RATE_HALF_LIFE_DAYS = 28;
const RATE_LAMBDA = Math.LN2 / RATE_HALF_LIFE_DAYS;

/** Cap on interval-length weight to prevent a single long gap from dominating. */
const MAX_INTERVAL_WEIGHT_DAYS = 7;

export function calcConsumptionEstimate(
  logs: LogRow[],
  alertDays: number
): ConsumptionEstimate {
  const empty: ConsumptionEstimate = {
    dailyRate: 0, estimatedValue: 0, estimatedDays: 0, drainPct: 0, status: "ok",
  };

  if (logs.length < 2) return empty;

  // Filter anomalies for rate calculation; keep all logs for value projection
  const validLogs = [...logs]
    .filter((l) => !l.is_anomaly)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

  if (validLogs.length < 2) return empty;

  const now = Date.now();
  let weightedRateSum = 0;
  let weightSum = 0;

  for (let i = 0; i < validLogs.length - 1; i++) {
    const a = validLogs[i];
    const b = validLogs[i + 1];

    // A topup causes value to rise — skip this pair (it's not a consumption interval)
    if (b.is_topup || b.value >= a.value) continue;

    const intervalDays = (new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()) / 86_400_000;
    if (intervalDays <= 0) continue;

    const rate = (a.value - b.value) / intervalDays;

    // Time decay: intervals that ended more recently carry more weight
    const daysAgo = (now - new Date(b.recorded_at).getTime()) / 86_400_000;
    const timeWeight = Math.exp(-RATE_LAMBDA * daysAgo);

    // Length weight: longer intervals are more reliable; cap to avoid dominance
    const lengthWeight = Math.min(intervalDays, MAX_INTERVAL_WEIGHT_DAYS);

    const weight = timeWeight * lengthWeight;
    weightedRateSum += rate * weight;
    weightSum += weight;
  }

  if (weightSum === 0) return empty;

  const dailyRate = weightedRateSum / weightSum;
  if (dailyRate <= 0) return empty;

  // Project from the most recent log (including anomaly logs for current value)
  const allSorted = [...logs].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const lastLog = allSorted[allSorted.length - 1];
  const daysSinceLast = (now - new Date(lastLog.recorded_at).getTime()) / 86_400_000;
  const estimatedValue = Math.max(0, lastLog.value - daysSinceLast * dailyRate);
  const estimatedDays = Math.floor(estimatedValue / dailyRate);

  const drainPct = calcDrainPct(estimatedDays, alertDays);
  const status = calcStatus(estimatedDays);

  return { dailyRate, estimatedValue, estimatedDays, drainPct, status };
}

// ── Deadline helpers ──────────────────────────────────────────────────────────

export function calcDeadlineMetrics(
  expireDate: string,
  alertDays: number,
  startDate?: string | null,
): { daysLeft: number; drainPct: number; status: ItemStatus } {
  const now = Date.now();
  const expire = new Date(expireDate).getTime();
  const daysLeft = Math.ceil((expire - now) / 86_400_000);

  let drainPct: number;
  if (startDate) {
    // Use the actual service period
    const start = new Date(startDate).getTime();
    const totalDays = Math.max(1, Math.ceil((expire - start) / 86_400_000));
    const elapsed = Math.max(0, totalDays - Math.max(0, daysLeft));
    drainPct = Math.max(0, Math.min(100, Math.round((1 - elapsed / totalDays) * 100)));
  } else {
    // No start date: scale against 365 days as a sensible reference window
    drainPct = Math.max(0, Math.min(100, Math.round((Math.max(0, daysLeft) / 365) * 100)));
  }

  const status = calcStatus(daysLeft, alertDays);
  return { daysLeft, drainPct, status };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

function calcStatus(daysLeft: number, alertDays = 30): ItemStatus {
  if (daysLeft <= 0)           return "expired";
  if (daysLeft <= 7)           return "danger";
  if (daysLeft <= alertDays)   return "warning";
  return "ok";
}

function calcDrainPct(estimatedDays: number, alertDays: number): number {
  // 30 days = full health (100%); scales down to 0% at 0 days.
  // alertDays acts as a minimum threshold — anything below alertDays is always < 30%.
  const fullAt = Math.max(30, alertDays * 4);
  return Math.max(0, Math.min(100, Math.round((estimatedDays / fullAt) * 100)));
}
