import sql from "./db";

// ── Helpers ────────────────────────────────────────────────────────────────

/** True when the "user" table already uses better-auth's camelCase column names. */
async function authSchemaIsCorrect(): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user'
      AND column_name = 'emailVerified'
    LIMIT 1
  `;
  return rows.length > 0;
}

// ── Main migration ─────────────────────────────────────────────────────────

export async function migrate(): Promise<void> {

  // ── Phase 1: Auth tables ──────────────────────────────────────────────
  //
  // better-auth requires camelCase column names (emailVerified, createdAt …).
  // If the tables were created with snake_case (old schema), we drop and
  // recreate. This is safe because no real user data exists yet at this point.

  const needsAuthRebuild = !(await authSchemaIsCorrect());

  if (needsAuthRebuild) {
    // Drop in reverse FK-dependency order so CASCADE isn't needed on "user".
    await sql`DROP TABLE IF EXISTS invite_codes`;
    await sql`DROP TABLE IF EXISTS "account"`;
    await sql`DROP TABLE IF EXISTS "session"`;
    await sql`DROP TABLE IF EXISTS "verification"`;
    // CASCADE removes FK constraints on items.user_id, will be re-added below.
    await sql`DROP TABLE IF EXISTS "user" CASCADE`;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS "user" (
      id              TEXT        PRIMARY KEY,
      name            TEXT        NOT NULL,
      email           TEXT        NOT NULL UNIQUE,
      "emailVerified" BOOLEAN     NOT NULL DEFAULT FALSE,
      image           TEXT,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      role            TEXT        DEFAULT 'user',
      banned          BOOLEAN,
      "banReason"     TEXT,
      "banExpires"    TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "session" (
      id                TEXT        PRIMARY KEY,
      "expiresAt"       TIMESTAMPTZ NOT NULL,
      token             TEXT        NOT NULL UNIQUE,
      "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "ipAddress"       TEXT,
      "userAgent"       TEXT,
      "userId"          TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "impersonatedBy"  TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "account" (
      id                        TEXT        PRIMARY KEY,
      "accountId"               TEXT        NOT NULL,
      "providerId"              TEXT        NOT NULL,
      "userId"                  TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accessToken"             TEXT,
      "refreshToken"            TEXT,
      "idToken"                 TEXT,
      "accessTokenExpiresAt"    TIMESTAMPTZ,
      "refreshTokenExpiresAt"   TIMESTAMPTZ,
      scope                     TEXT,
      password                  TEXT,
      "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "verification" (
      id          TEXT        PRIMARY KEY,
      identifier  TEXT        NOT NULL,
      value       TEXT        NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ,
      "updatedAt" TIMESTAMPTZ
    )
  `;

  // ── Invite codes (our own table — snake_case is fine) ─────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      code        TEXT        PRIMARY KEY,
      created_by  TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      used_by     TEXT        REFERENCES "user"(id),
      used_at     TIMESTAMPTZ,
      expires_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // ── Phase 3: Clean up legacy demo user ───────────────────────────────
  //
  // Older deployments created a 'demo' user as a placeholder for existing
  // items. Now that demo mode is fully client-side, we reassign demo-owned
  // items to the first admin and remove the demo account. This runs only
  // once — once the demo row is gone it becomes a no-op.

  await sql`
    DO $$
    DECLARE
      v_admin_id TEXT;
    BEGIN
      SELECT id INTO v_admin_id
        FROM "user"
       WHERE email != 'demo@lifetimer.local'
         AND role = 'admin'
       LIMIT 1;

      IF v_admin_id IS NOT NULL THEN
        UPDATE items SET user_id = v_admin_id
         WHERE user_id = 'demo';
        DELETE FROM "user" WHERE id = 'demo';
      END IF;
    END $$
  `;

  // ── App tables ────────────────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS items (
      id          SERIAL PRIMARY KEY,
      name        TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK(type IN ('deadline','consumption')),
      notes       TEXT,
      archived_at TEXT,
      user_id     TEXT,
      created_at  TEXT    NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS."000Z"'),
      updated_at  TEXT    NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS."000Z"')
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tags (
      id    SERIAL PRIMARY KEY,
      name  TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6B7280'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS item_tags (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
      PRIMARY KEY (item_id, tag_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS deadline_items (
      item_id     INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
      expire_date TEXT    NOT NULL,
      start_date  TEXT,
      alert_days  INTEGER NOT NULL DEFAULT 30
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS deadline_renewals (
      id              SERIAL PRIMARY KEY,
      item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      renewed_at      TEXT    NOT NULL DEFAULT TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS."000Z"'),
      old_expire_date TEXT    NOT NULL,
      new_expire_date TEXT    NOT NULL,
      notes           TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS consumption_items (
      item_id    INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
      unit       TEXT    NOT NULL,
      alert_days INTEGER NOT NULL DEFAULT 7
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS consumption_logs (
      id          SERIAL PRIMARY KEY,
      item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      recorded_at TEXT    NOT NULL,
      value       REAL    NOT NULL,
      is_topup    BOOLEAN NOT NULL DEFAULT FALSE,
      is_anomaly  BOOLEAN NOT NULL DEFAULT FALSE,
      notes       TEXT
    )
  `;

  // ── items.user_id: add column + FK (idempotent) ───────────────────────

  // Add column if it doesn't exist (no-op if already present)
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS user_id TEXT`;

  // Leave NULL user_id rows as-is; they will be assigned once admin is created

  // Re-add FK constraint idempotently (drop first, then add)
  await sql`ALTER TABLE items DROP CONSTRAINT IF EXISTS items_user_id_fkey`;
  await sql`
    ALTER TABLE items
    ADD CONSTRAINT items_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
  `;

  // ── Indexes ───────────────────────────────────────────────────────────

  await sql`CREATE INDEX IF NOT EXISTS idx_items_type     ON items(type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_items_archived ON items(archived_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_items_user     ON items(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cons_logs_item ON consumption_logs(item_id, recorded_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_renewals_item  ON deadline_renewals(item_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_session_user   ON "session"("userId")`;
  await sql`CREATE INDEX IF NOT EXISTS idx_session_token  ON "session"(token)`;

  // ── Push notification tables ───────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      endpoint    TEXT        NOT NULL UNIQUE,
      p256dh      TEXT        NOT NULL,
      auth        TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`;

  // Deduplication log: prevents the same item alerting the same user more than once per day
  await sql`
    CREATE TABLE IF NOT EXISTS push_log (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT        NOT NULL,
      item_id     INTEGER     NOT NULL,
      sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_push_log_user_item ON push_log(user_id, item_id, sent_at)`;

  // ── PWA diagnostics log ───────────────────────────────────────────────────
  // Stores client-side diagnostic reports submitted from /pwa-check page.
  // No user_id FK because the page is public (user may not be logged in).

  await sql`
    CREATE TABLE IF NOT EXISTS pwa_diagnostics (
      id              SERIAL      PRIMARY KEY,
      user_agent      TEXT,
      is_ios          BOOLEAN,
      ios_version     TEXT,
      is_android      BOOLEAN,
      is_standalone   BOOLEAN,
      sw_supported    BOOLEAN,
      sw_registered   BOOLEAN,
      notif_supported BOOLEAN,
      notif_perm      TEXT,
      push_supported  BOOLEAN,
      manifest_ok     BOOLEAN,
      manifest_mime   TEXT,
      icon192_ok      BOOLEAN,
      apple_icon_ok   BOOLEAN,
      apple_icon_mime TEXT,
      apple_icon_url  TEXT,
      is_https        BOOLEAN,
      raw_data        JSONB,
      submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_pwa_diag_time ON pwa_diagnostics(submitted_at DESC)`;
}
