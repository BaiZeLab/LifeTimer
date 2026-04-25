import type Database from "better-sqlite3";

export function migrate(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK(type IN ('deadline','consumption')),
      notes       TEXT,
      archived_at TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6B7280'
    );

    CREATE TABLE IF NOT EXISTS item_tags (
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
      PRIMARY KEY (item_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS deadline_items (
      item_id     INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
      expire_date TEXT    NOT NULL,
      start_date  TEXT,      -- optional: service start date for accurate drain bar
      alert_days  INTEGER NOT NULL DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS deadline_renewals (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      renewed_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      old_expire_date TEXT    NOT NULL,
      new_expire_date TEXT    NOT NULL,
      notes           TEXT
    );

    CREATE TABLE IF NOT EXISTS consumption_items (
      item_id    INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
      unit       TEXT    NOT NULL,
      alert_days INTEGER NOT NULL DEFAULT 7
    );

    CREATE TABLE IF NOT EXISTS consumption_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      recorded_at TEXT    NOT NULL,
      value       REAL    NOT NULL,
      is_topup    INTEGER NOT NULL DEFAULT 0,
      is_anomaly  INTEGER NOT NULL DEFAULT 0,
      notes       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_items_type        ON items(type);
    CREATE INDEX IF NOT EXISTS idx_items_archived    ON items(archived_at);
    CREATE INDEX IF NOT EXISTS idx_cons_logs_item    ON consumption_logs(item_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_renewals_item     ON deadline_renewals(item_id);
  `);
}
