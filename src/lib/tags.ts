import db from "./db";

/**
 * Ensure tags exist (upsert) and sync item_tags in one transaction.
 * Handles create-if-not-exists + overwrite old associations atomically.
 */
export function syncItemTags(itemId: number, tagNames: string[]): void {
  const sync = db.transaction((names: string[]) => {
    // Remove existing associations
    db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(itemId);

    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed) continue;

      // Upsert tag
      db.prepare(
        "INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING"
      ).run(trimmed);

      const tag = db.prepare("SELECT id FROM tags WHERE name = ?").get(trimmed) as
        | { id: number }
        | undefined;

      if (tag) {
        db.prepare(
          "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)"
        ).run(itemId, tag.id);
      }
    }
  });

  sync(tagNames);
}

export function getItemTagNames(itemId: number): string[] {
  const rows = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN item_tags it ON it.tag_id = t.id
       WHERE it.item_id = ?`
    )
    .all(itemId) as { name: string }[];
  return rows.map((r) => r.name);
}
