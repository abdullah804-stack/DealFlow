import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight middleware for route protection.
 *
 * Does NOT import @/lib/auth (which pulls in Prisma + bcrypt, ~1 MB).
 * Instead, it checks for the presence of an Auth.js session cookie.
 * Actual authentication is enforced server-side by requireUserId() in
 * each protected page and API route.
 *
 * This is intentionally minimal: the middleware's only job is to bounce
 * anonymous users away from /dashboard/* before they hit a server
 * component that would render the login redirect anyway.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth.js v5 uses one of these cookie names depending on https/http
  const sessionCookie =
    req.cookies.get("authjs.session-token") ??
    req.cookies.get("__Secure-authjs.session-token");

  if (!sessionCookie && pathname.startsWith("/dashboard")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};