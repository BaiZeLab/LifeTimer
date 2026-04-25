export type ItemType = "deadline" | "consumption";
export type ItemStatus = "ok" | "warning" | "danger" | "expired";

// ── Shared ────────────────────────────────────────────────────────────────────

export interface Tag {
  id: number;
  name: string;
  color: string;
}

// ── Deadline ──────────────────────────────────────────────────────────────────

export interface DeadlineItemDTO {
  id: number;
  type: "deadline";
  name: string;
  notes: string | null;
  tags: string[];
  expireDate: string;      // YYYY-MM-DD
  startDate: string | null; // YYYY-MM-DD, optional
  alertDays: number;
  daysLeft: number;        // computed
  drainPct: number;        // computed, 0–100
  status: ItemStatus;      // computed
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeadlineRenewal {
  id: number;
  itemId: number;
  renewedAt: string;
  oldExpireDate: string;
  newExpireDate: string;
  notes: string | null;
}

// ── Consumption ───────────────────────────────────────────────────────────────

export interface ConsumptionItemDTO {
  id: number;
  type: "consumption";
  name: string;
  notes: string | null;
  tags: string[];
  unit: string;
  alertDays: number;
  logCount: number;        // computed
  lastRecordedAt: string | null;   // computed
  lastRecordedDaysAgo: number;     // computed
  lastRecordedValue: number | null; // computed — useful for cold-start 1-log display
  estimatedValue: number;          // computed
  estimatedDays: number;           // computed
  dailyRate: number;               // computed
  drainPct: number;                // computed, 0–100
  status: ItemStatus;              // computed
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsumptionLog {
  id: number;
  itemId: number;
  recordedAt: string;
  value: number;
  isTopup: boolean;
  isAnomaly: boolean;
  notes: string | null;
}

// ── Union ─────────────────────────────────────────────────────────────────────

export type ItemDTO = DeadlineItemDTO | ConsumptionItemDTO;

// ── Request bodies ────────────────────────────────────────────────────────────

export interface CreateDeadlineBody {
  type: "deadline";
  name: string;
  notes?: string;
  tags?: string[];
  expireDate: string;
  startDate?: string;
  alertDays?: number;
}

export interface CreateConsumptionBody {
  type: "consumption";
  name: string;
  notes?: string;
  tags?: string[];
  unit: string;
  alertDays?: number;
}

export type CreateItemBody = CreateDeadlineBody | CreateConsumptionBody;

export interface PatchItemBody {
  name?: string;
  notes?: string;
  tags?: string[];
  alertDays?: number;
  startDate?: string | null;
  archived?: boolean;
}

export interface RenewBody {
  newExpireDate: string;
  newStartDate?: string;  // defaults to previous expire_date
  notes?: string;
}

export interface CreateLogBody {
  recordedAt: string;
  value: number;
  notes?: string;
}

export interface PatchLogBody {
  isAnomaly?: boolean;
  notes?: string;
  value?: number;
}
