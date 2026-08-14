import { randomBytes } from "crypto";
import sql from "./db";

// ── Config ───────────────────────────────────────────────────────────────────

// Anti-abuse guard, not authentication — the token itself is the only
// credential by design. This only protects against a leaked/misused token
// flooding the push service and the database.
const RATE_LIMIT_PER_MINUTE = 20;
const RATE_LIMIT_PER_HOUR = 120;

// Keep the inbox bounded per user; oldest entries beyond this are pruned.
const MAX_LOG_ENTRIES = 10;

export const TITLE_MAX_LEN = 100;
export const BODY_MAX_LEN = 2000;

export interface WebhookTokenRow {
  token: string;
  created_at: string;
  rotated_at: string | null;
  last_used_at: string | null;
}

export interface WebhookLogRow {
  id: number;
  title: string;
  body: string;
  status: "sent" | "undelivered";
  delivered: number;
  created_at: string;
}

// ── Token management ─────────────────────────────────────────────────────────

function generateToken(): string {
  // 24 random bytes → 32-char base64url string. Not guessable, URL-safe.
  return randomBytes(24).toString("base64url");
}

/** Returns the current user's webhook token, creating one on first access. */
export async function getOrCreateWebhookToken(userId: string): Promise<WebhookTokenRow> {
  const existing = await sql`
    SELECT token, created_at, rotated_at, last_used_at FROM webhook_tokens WHERE user_id = ${userId}
  ` as WebhookTokenRow[];
  if (existing.length) return existing[0];

  const token = generateToken();
  // ON CONFLICT DO UPDATE with a no-op SET guarantees RETURNING always yields a
  // row (including on a concurrent-insert race), unlike DO NOTHING.
  const rows = await sql`
    INSERT INTO webhook_tokens (user_id, token) VALUES (${userId}, ${token})
    ON CONFLICT (user_id) DO UPDATE SET token = webhook_tokens.token
    RETURNING token, created_at, rotated_at, last_used_at
  ` as WebhookTokenRow[];
  return rows[0];
}

/** Rotates (regenerates) the current user's token. The old URL stops working immediately. */
export async function rotateWebhookToken(userId: string): Promise<WebhookTokenRow> {
  const token = generateToken();
  const rows = await sql`
    INSERT INTO webhook_tokens (user_id, token, rotated_at)
    VALUES (${userId}, ${token}, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET token = ${token}, rotated_at = NOW()
    RETURNING token, created_at, rotated_at, last_used_at
  ` as WebhookTokenRow[];
  return rows[0];
}

/** Looks up the owning user_id for a token. Returns null when the token doesn't exist. */
export async function findUserIdByToken(token: string): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM webhook_tokens WHERE token = ${token}` as { user_id: string }[];
  return rows.length ? rows[0].user_id : null;
}

export async function touchWebhookToken(token: string): Promise<void> {
  await sql`UPDATE webhook_tokens SET last_used_at = NOW() WHERE token = ${token}`;
}

// ── Rate limiting (anti-abuse, not auth) ────────────────────────────────────

export async function isRateLimited(userId: string): Promise<boolean> {
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute') AS per_min,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')   AS per_hour
    FROM webhook_log WHERE user_id = ${userId}
  ` as { per_min: string; per_hour: string }[];
  const { per_min, per_hour } = rows[0];
  return Number(per_min) >= RATE_LIMIT_PER_MINUTE || Number(per_hour) >= RATE_LIMIT_PER_HOUR;
}

// ── Notification log (doubles as the user-facing inbox) ─────────────────────

export async function insertWebhookLog(params: {
  userId: string;
  ip: string | null;
  title: string;
  body: string;
}): Promise<number> {
  const rows = await sql`
    INSERT INTO webhook_log (user_id, ip, title, body)
    VALUES (${params.userId}, ${params.ip}, ${params.title}, ${params.body})
    RETURNING id
  ` as { id: number }[];

  // Trim to the newest MAX_LOG_ENTRIES rows for this user.
  await sql`
    DELETE FROM webhook_log
    WHERE user_id = ${params.userId}
      AND id IN (
        SELECT id FROM webhook_log
        WHERE user_id = ${params.userId}
        ORDER BY created_at DESC
        OFFSET ${MAX_LOG_ENTRIES}
      )
  `;

  return rows[0].id;
}

export async function updateWebhookLogResult(
  id: number,
  result: { status: "sent" | "undelivered"; delivered: number }
): Promise<void> {
  await sql`
    UPDATE webhook_log SET status = ${result.status}, delivered = ${result.delivered}
    WHERE id = ${id}
  `;
}

export async function listWebhookLog(userId: string, limit = MAX_LOG_ENTRIES): Promise<WebhookLogRow[]> {
  return await sql`
    SELECT id, title, body, status, delivered, created_at
    FROM webhook_log
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  ` as WebhookLogRow[];
}

// ── Payload parsing ──────────────────────────────────────────────────────────

/** Accepts a handful of common field-name aliases so simple/dumb webhook senders work out of the box. */
export function extractPayload(source: Record<string, unknown>): { title: string; body: string | null } {
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = source[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  const title = pick("title", "subject") ?? "Webhook 通知";
  const body = pick("body", "text", "message", "content");
  return { title: title.slice(0, TITLE_MAX_LEN), body: body ? body.slice(0, BODY_MAX_LEN) : null };
}
