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

const fs     = require("fs");
const crypto = require("crypto");
const path   = require("path");
const http   = require("http");

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

// ── Icons generation (PWA) ────────────────────────────────────────────────────

function generateIcons() {
  try {
    require(path.join(__dirname, "scripts", "generate-icons.js"));
    console.log("[startup] PWA icons generated");
  } catch (e) {
    console.warn("[startup] Could not generate PWA icons:", e.message);
  }
}

generateIcons();

// ── Start Next.js standalone server ──────────────────────────────────────────

require("./server.js");

// ── Cron scheduler ────────────────────────────────────────────────────────────

const PORT     = process.env.PORT     || 3000;
const HOSTNAME = process.env.HOSTNAME || "localhost";
const SECRET   = process.env.CRON_SECRET || "";

const POLL_URL = `http://${HOSTNAME}:${PORT}/`;
const CRON_URL = `http://${HOSTNAME}:${PORT}/api/cron`;
const CRON_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function executeCronJob() {
  const headers = SECRET ? { "x-cron-secret": SECRET } : {};
  const options = {
    hostname: HOSTNAME,
    port:     PORT,
    path:     "/api/cron",
    method:   "GET",
    headers,
    timeout:  30000,
  };

  const req = http.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log("[cron] Job executed:", data.slice(0, 200));
      } else {
        console.error("[cron] Job failed:", res.statusCode, data.slice(0, 200));
      }
    });
  });

  req.on("error", (err) => console.error("[cron] Error:", err.message));
  req.on("timeout", () => { console.error("[cron] Timeout"); req.destroy(); });
  req.end();
}

// Poll until server is ready, then start cron.
// Guard flag prevents double-start when two poll requests land before clearInterval fires.
let cronStarted = false;
const pollId = setInterval(() => {
  const req = http.get(POLL_URL, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 400 && !cronStarted) {
      cronStarted = true;
      clearInterval(pollId);
      console.log("[startup] Server is ready — starting cron scheduler");

      // First run immediately (with a small delay to let DB migrations finish)
      setTimeout(executeCronJob, 5000);

      // Then every hour
      setInterval(executeCronJob, CRON_INTERVAL_MS);
    }
  });
  req.setTimeout(2000, () => req.destroy());
  req.on("error", () => {}); // ignore connection-refused during startup
}, 1000);
