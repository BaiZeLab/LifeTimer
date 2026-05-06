import sql from "./db";

export async function migrate(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS items (
      id          SERIAL PRIMARY KEY,
      name        TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK(type IN ('deadline','consumption')),
      notes       TEXT,
      archived_at TEXT,
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

  await sql`CREATE INDEX IF NOT EXISTS idx_items_type     ON items(type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_items_archived ON items(archived_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_cons_logs_item ON consumption_logs(item_id, recorded_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_renewals_item  ON deadline_renewals(item_id)`;
}
