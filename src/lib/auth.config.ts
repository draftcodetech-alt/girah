import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js base config — shared by the full server config
 * (src/lib/auth.ts) and the middleware instance (src/lib/auth.edge.ts).
 *
 * This file MUST stay importable from the middleware bundle: no `db`,
 * no bcrypt, no Node-only code. The middleware only decodes the session
 * cookie and bounces signed-out visitors — the authoritative per-read DB
 * re-check (jwt callback in auth.ts) runs on every server-side `auth()`
 * call (page guards, actions, layouts), so disabling a user still takes
 * effect immediately.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  // Without this, Auth.js rejects every request on self-hosted production
  // (NODE_ENV=production, no AUTH_URL) — and login() then reports success
  // without ever setting a session cookie (Phase 1 C3).
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  // The Credentials provider (authorize → bcrypt + DB) lives in auth.ts so
  // middleware never bundles it. Middleware never signs anyone in.
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "CUSTOMER" | "ADMIN";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
