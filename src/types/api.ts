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
  oldStartDate: string | null;
  oldExpireDate: string;
  newStartDate: string | null;
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

// ── Recipe ────────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  name: string;
  quantity: string;  // free text: "2 个" / "适量" / "300g"; "" = not recorded
}

/** List payload — carries ingredients (the main thing users look up) but only a step count. */
export interface RecipeSummaryDTO {
  id: number;
  name: string;
  category: string | null;
  servings: string | null;
  notes: string | null;
  ingredients: RecipeIngredient[];
  stepCount: number;   // computed
  createdAt: string;
  updatedAt: string;
}

export interface RecipeDTO extends RecipeSummaryDTO {
  steps: string[];
}

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

export interface CreateRecipeBody {
  name: string;
  category?: string;
  servings?: string;
  notes?: string;
  ingredients?: RecipeIngredient[];
  steps?: string[];
}

/** Ingredients and steps are replaced as a whole when present. */
export interface PatchRecipeBody {
  name?: string;
  category?: string | null;
  servings?: string | null;
  notes?: string | null;
  ingredients?: RecipeIngredient[];
  steps?: string[];
}
