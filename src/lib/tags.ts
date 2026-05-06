import sql from "./db";

/**
 * Ensure tags exist (upsert) and sync item_tags in one transaction.
 * Uses unnest() to bulk-upsert tags and re-link them atomically.
 */
export async function syncItemTags(itemId: number, tagNames: string[]): Promise<void> {
  const trimmed = tagNames.map((n) => n.trim()).filter(Boolean);

  if (trimmed.length === 0) {
    await sql`DELETE FROM item_tags WHERE item_id = ${itemId}`;
    return;
  }

  await sql.transaction((txSql) => [
    txSql`DELETE FROM item_tags WHERE item_id = ${itemId}`,
    txSql`INSERT INTO tags (name) SELECT unnest(${trimmed}::text[]) ON CONFLICT(name) DO NOTHING`,
    txSql`
      INSERT INTO item_tags (item_id, tag_id)
      SELECT ${itemId}, id FROM tags WHERE name = ANY(${trimmed})
      ON CONFLICT DO NOTHING
    `,
  ]);
}

export async function getItemTagNames(itemId: number): Promise<string[]> {
  const rows = await sql`
    SELECT t.name FROM tags t
    JOIN item_tags it ON it.tag_id = t.id
    WHERE it.item_id = ${itemId}
  ` as { name: string }[];
  return rows.map((r) => r.name);
}
