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
 * 1. Split logs into segments by topup events.
 * 2. Each segment rate = (start_value - end_value) / days.
 * 3. Weighted average with exponential decay (recent segments weighted higher).
 * 4. Project current estimated value from last log.
 * 5. Estimate days remaining.
 */
export function calcConsumptionEstimate(
  logs: LogRow[],
  alertDays: number
): ConsumptionEstimate {
  const empty: ConsumptionEstimate = {
    dailyRate: 0, estimatedValue: 0, estimatedDays: 0, drainPct: 0, status: "ok",
  };

  if (logs.length < 2) return empty;

  // Filter anomalies out for rate calculation, but keep for value projection
  const validLogs = [...logs].filter((l) => !l.is_anomaly).sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  if (validLogs.length < 2) return empty;

  // Split into segments: a new segment starts after a topup
  interface Segment {
    startValue: number;
    endValue: number;
    days: number;
  }
  const segments: Segment[] = [];
  let segStart = validLogs[0];

  for (let i = 1; i < validLogs.length; i++) {
    const cur = validLogs[i];
    if (cur.is_topup) {
      // Previous segment ends at the point just before topup
      const prev = validLogs[i - 1];
      const days = daysBetween(segStart.recorded_at, prev.recorded_at);
      if (days > 0 && segStart.value > prev.value) {
        segments.push({ startValue: segStart.value, endValue: prev.value, days });
      }
      segStart = cur;
    }
  }
  // Last (current) segment
  const last = validLogs[validLogs.length - 1];
  const lastDays = daysBetween(segStart.recorded_at, last.recorded_at);
  if (lastDays > 0 && segStart.value > last.value) {
    segments.push({ startValue: segStart.value, endValue: last.value, days: lastDays });
  }

  if (segments.length === 0) return empty;

  // Weighted average (exponential decay: newest segment has weight 1, each older halved)
  let weightedRateSum = 0;
  let weightSum = 0;
  segments.forEach((seg, i) => {
    const rate = (seg.startValue - seg.endValue) / seg.days;
    const weight = Math.pow(2, i);  // newer = higher index = higher weight
    weightedRateSum += rate * weight;
    weightSum += weight;
  });
  const dailyRate = weightSum > 0 ? weightedRateSum / weightSum : 0;

  if (dailyRate <= 0) return empty;

  // Project from last log
  const allLogs = [...logs].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const lastLog = allLogs[allLogs.length - 1];
  const daysSinceLast = daysBetween(lastLog.recorded_at, new Date().toISOString());
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
