/**
 * Docker entrypoint — runs before the Next.js server starts.
 *
 * BETTER_AUTH_SECRET
 *   If not set via env, tries to load from /app/data/auth-secret (volume-mounted).
 *   If that file doesn't exist either, generates a new secret, writes it to the
 *   file (so it survives container restarts), and sets it on process.env.
 *
 * BETTER_AUTH_URL
 *   Not required for email/password auth. better-auth derives the base URL from
 *   incoming requests when this is absent.
 */

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const SECRET_FILE = path.join("/app/data", "auth-secret");

function ensureAuthSecret() {
  if (process.env.BETTER_AUTH_SECRET) return; // already set via env

  // Try to load persisted secret from volume
  try {
    const persisted = fs.readFileSync(SECRET_FILE, "utf8").trim();
    if (persisted.length >= 32) {
      process.env.BETTER_AUTH_SECRET = persisted;
      console.log("[startup] BETTER_AUTH_SECRET loaded from", SECRET_FILE);
      return;
    }
  } catch {
    // File doesn't exist yet — will generate below
  }

  // Generate and persist
  const secret = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
    console.log("[startup] BETTER_AUTH_SECRET generated and saved to", SECRET_FILE);
  } catch (e) {
    console.warn("[startup] Could not persist auth secret:", e.message);
    console.warn("[startup] Sessions will be invalidated on container restart.");
  }
  process.env.BETTER_AUTH_SECRET = secret;
}

ensureAuthSecret();

require("./server.js");
