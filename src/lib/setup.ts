import sql from "./db";

/**
 * Returns true if at least one user account exists.
 */
export async function isInitialized(): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM "user"
    WHERE email != 'demo@lifetimer.local'
    LIMIT 1
  ` as unknown[];
  return rows.length > 0;
}
