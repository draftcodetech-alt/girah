import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * The middleware (proxy.ts) instance of Auth.js: decodes the session
 * cookie and exposes `req.auth` for the redirect logic only. Built from
 * the edge-safe base config so the middleware bundle never pulls in the
 * DB, bcrypt, or the credentials provider (they fail outside the Node
 * runtime — the bundle used to break every authed middleware route).
 *
 * Authoritative checks (disabled users, session-version bumps, roles)
 * still happen on every server-side `auth()` call via auth.ts.
 */
export const { auth } = NextAuth(authConfig);
