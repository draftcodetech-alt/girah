import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isAccountRoute = pathname.startsWith("/account");
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  if (isAdminRoute && (!isLoggedIn || role !== "ADMIN")) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (isAccountRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
