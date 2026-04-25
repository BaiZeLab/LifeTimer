import BetterSqlite3 from "better-sqlite3";
import path from "path";
import fs from "fs";
import { migrate } from "./schema";

const DB_PATH = path.join(process.cwd(), "data", "life-timer.db");

function openDb(): BetterSqlite3.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new BetterSqlite3(DB_PATH);
  migrate(db);
  return db;
}

// Singleton: reuse the same connection across hot-reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var __db: BetterSqlite3.Database | undefined;
}

const db: BetterSqlite3.Database =
  globalThis.__db ?? (globalThis.__db = openDb());

export default db;
