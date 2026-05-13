import sql from "./db";

/**
 * Returns true if at least one real (non-demo) user exists.
 * The demo account created by migration is not counted as "initialized".
 */
export async function isInitialized(): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM "user"
    WHERE email != 'demo@lifetimer.local'
    LIMIT 1
  ` as unknown[];
  return rows.length > 0;
}
