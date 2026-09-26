import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import * as authModule from "@/lib/auth";

export type CookieJarSession = { id: string; email: string | null };

// Phase 5 — session proof inside the SAME server action that just called
// signIn().
//
// `auth()` can't answer that question here: with no arguments it rebuilds its
// Request from the *incoming* request headers (next-auth/lib/index.js
// `getSession(await headers(), config)`), while `signIn()` writes the fresh
// session cookie into the response cookie jar
// (next-auth/lib/actions.js `cookieJar.set(...)`). Nothing copies that write
// back into `headers()`, so `auth()` inside the action always reads the
// pre-sign-in state.
//
// Instead, take the cookie jar as it now stands and replay it through Auth.js's
// own `/api/auth/session` handler — the exact pipeline `auth()` would run
// (jwt + session callbacks, expiry, secret rotation), only with the cookies
// that actually exist instead of the stale request headers.
//
// Fails closed: no session cookie, a non-OK response (Auth.js reports config
// errors as 500s) or an unusable body all read as "no session".
export async function readSessionFromCookieJar(): Promise<CookieJarSession | null> {
  try {
    // Route back through the same `@/lib/auth` module so a test double for it
    // short-circuits here instead of reaching for a request-scoped cookie jar.
    const handler = authModule.handlers?.GET;
    if (!handler) return null;

    const jar = await cookies();
    const cookieHeader = jar
      .getAll()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    if (!cookieHeader) return null;

    const requestHeaders = await headers();
    const protocol = (requestHeaders.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
    const host =
      requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ||
      requestHeaders.get("host") ||
      "localhost";
    const response = await handler(
      new NextRequest(`${protocol}://${host}/api/auth/session`, {
        headers: { cookie: cookieHeader },
      })
    );
    if (!response.ok) return null;

    const body = (await response.json().catch(() => null)) as {
      user?: { id?: unknown; email?: unknown };
    } | null;
    if (typeof body?.user?.id !== "string" || body.user.id.length === 0) return null;
    return {
      id: body.user.id,
      email: typeof body.user.email === "string" ? body.user.email : null,
    };
  } catch (error) {
    console.error("cookie-jar session lookup failed:", error);
    return null;
  }
}
