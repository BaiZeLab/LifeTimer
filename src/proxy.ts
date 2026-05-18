import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

// ── Setup-status in-memory cache ─────────────────────────────────────────────
//
// Single-instance Docker deployment: one cache per process is safe.
// null  = not yet queried
// true  = at least one real (non-demo) user exists
// false = system is uninitialized
let initializedCache: boolean | null = null;

async function checkInitialized(): Promise<boolean> {
  if (initializedCache === true) return true;
  // Use a lightweight raw query here — proxy cannot import from @/lib/db
  // because that module uses a Proxy object incompatible with Edge restrictions.
  // We instantiate a bare neon client directly.
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT 1 FROM "user"
    WHERE email != 'demo@lifetimer.local'
    LIMIT 1
  `;
  initializedCache = rows.length > 0;
  return initializedCache;
}

// Called by the setup API after successful admin creation to invalidate the cache.
// (Only useful within the same process — which is guaranteed in single-instance Docker.)
export function markInitialized() {
  initializedCache = true;
}

// ── Path constants ────────────────────────────────────────────────────────────

const SETUP_PATH = "/auth/setup";
const LOGIN_PATH = "/auth/login";

// Paths that are always public (no auth, no setup-guard)
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/api/auth/register",
  "/api/auth/setup",
  "/api/auth/setup-status",
  "/demo",
];

// better-auth manages its own routes under /api/auth/**
const BETTER_AUTH_PREFIX = "/api/auth/";

// ── Proxy ─────────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and PWA resources — always pass through without auth.
  // These must be publicly accessible: iOS/Android read manifest.json and icons
  // during "Add to Home Screen" without a session cookie.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/favicon.svg" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||       // PWA manifest — required for standalone mode
    pathname === "/sw.js" ||               // Service Worker — required for push & offline
    pathname.startsWith("/icons/") ||      // PWA icons — required for home screen icon
    pathname.startsWith("/api/push/") ||    // VAPID public key endpoint (needed before login)
    pathname === "/pwa-check" ||            // Public PWA diagnostics page
    pathname === "/api/pwa-check"           // Diagnostics report collector (unauthenticated POST)
  ) {
    // Prevent Safari (especially iOS) from caching 307 redirects for PWA-critical resources.
    // Without this, a prior redirect response can get stuck in the browser's HTTP cache,
    // causing manifest.json and icons to appear broken even after the server is fixed.
    const res = NextResponse.next();
    if (
      pathname === "/manifest.json" ||
      pathname === "/sw.js" ||
      pathname.startsWith("/icons/")
    ) {
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.headers.set("Pragma", "no-cache");
    }
    return res;
  }

  // Block direct sign-up endpoint — must go through /api/auth/register (invite code)
  if (pathname === "/api/auth/sign-up/email" && request.method === "POST") {
    return NextResponse.json(
      { error: "Direct sign-up is disabled. Use /api/auth/register with an invite code." },
      { status: 403 }
    );
  }

  // Pass through all better-auth internal routes (session, sign-in, sign-out, …)
  if (pathname.startsWith(BETTER_AUTH_PREFIX)) {
    return NextResponse.next();
  }

  // ── Initialization guard ──────────────────────────────────────────────────

  const initialized = await checkInitialized();

  if (!initialized) {
    // System not set up: only /auth/setup (and its API) are allowed
    if (pathname === SETUP_PATH) return NextResponse.next();
    // Everything else → redirect to setup
    return NextResponse.redirect(new URL(SETUP_PATH, request.url));
  }

  // System is initialized: /auth/setup is no longer accessible
  if (pathname === SETUP_PATH) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  // ── Auth guard ────────────────────────────────────────────────────────────

  // Public paths (login, register, etc.)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes
  if (pathname.startsWith("/admin") && session.user.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.svg).*)"],
};
