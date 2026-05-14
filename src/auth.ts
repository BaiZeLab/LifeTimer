import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { Pool } from "@neondatabase/serverless";

// Uses @neondatabase/serverless Pool which is pg.Pool-compatible.
// better-auth wraps it via Kysely's PostgresDialect internally.
export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  secret: process.env.BETTER_AUTH_SECRET,
  // baseURL is intentionally omitted: better-auth derives it from incoming
  // requests, which works correctly for email/password auth without OAuth.
  // Set BETTER_AUTH_URL in .env.local only if you need OAuth callbacks.
  ...(process.env.BETTER_AUTH_URL ? { baseURL: process.env.BETTER_AUTH_URL } : {}),
  emailAndPassword: {
    enabled: true,
    // Public sign-up is blocked at the middleware level.
    // Registration goes through /api/auth/register (invite code required).
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,    // 7 days
    updateAge: 60 * 60 * 24,          // refresh once per day
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  trustedOrigins: process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : [],
  plugins: [admin()],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
