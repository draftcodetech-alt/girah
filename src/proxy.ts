import { auth } from "@/lib/auth.edge";
import { NextResponse } from "next/server";

// Phase 17: security headers for every response the app renders.
//
// CSP is deliberately permissive where Next.js requires it (inline bootstrap
// scripts/styles) and relaxed further in dev (HMR websocket, React refresh's
// eval). Everything is same-origin: the app makes no client-side calls to
// third parties — checkout leaves via full-page navigation, images come from
// Cloudinary (covered by `img-src https:`), fonts are self-hosted by next/font.
const isDev = process.env.NODE_ENV !== "production";

function applySecurityHeaders(res: NextResponse): void {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);

  if (!isDev) {
    // HSTS only in production: telling browsers to force-https localhost
    // would break the local http dev/preview servers.
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isAccountRoute = pathname.startsWith("/account");
  // Phase 15: the wishlist is personal data — same bounce as /account.
  const isWishlistRoute = pathname.startsWith("/wishlist");
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const loginUrl = () => {
    const callbackUrl = pathname + search;
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(url);
  };

  // Every exit path (redirect or next) carries the security headers.
  const respond = (res: NextResponse) => {
    applySecurityHeaders(res);
    return res;
  };

  if (isAdminRoute) {
    // Signed out → remember the destination so login lands back on it.
    if (!isLoggedIn) return respond(loginUrl());
    // Signed in without the role → home, never a login redirect (that would
    // bounce a logged-in customer straight back to /admin after every login).
    if (role !== "ADMIN") return respond(NextResponse.redirect(new URL("/", req.nextUrl.origin)));
  }

  if ((isAccountRoute || isWishlistRoute) && !isLoggedIn) {
    return respond(loginUrl());
  }

  return respond(NextResponse.next());
});

// Catch-all: security headers belong on EVERY response, not just the authed
// sections. Auth checks above still key off the specific path prefixes.
//
// /api/auth/* is excluded on purpose: Auth.js owns those endpoints (csrf
// handshake + its own cookie hygiene). Wrapping them with auth() adds a
// SECOND authjs.csrf-token to the response whose value differs from the one
// in the JSON body, and the merge order differs between runtimes (Node appends
// the handler's cookie last, OpenNext/workerd appends it first) — browsers
// keep the last cookie, so the csrf callback then fails with MissingCSRF.
export const config = {
  matcher: ["/((?!api/auth/).*)"],
};
