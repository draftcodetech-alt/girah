import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isAccountRoute = pathname.startsWith("/account");
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const loginUrl = () => {
    const callbackUrl = pathname + search;
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(url);
  };

  if (isAdminRoute) {
    // Signed out → remember the destination so login lands back on it.
    if (!isLoggedIn) return loginUrl();
    // Signed in without the role → home, never a login redirect (that would
    // bounce a logged-in customer straight back to /admin after every login).
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (isAccountRoute && !isLoggedIn) {
    return loginUrl();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
