import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/server/auth/jwt";

/**
 * Optimistic route protection. Verifies the signed session token only (no DB) so it stays
 * fast; every page, server action and API route re-checks the session and role against the
 * database before touching data.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/dashboard") && !claims) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Note: /login and /register check the session against the database themselves. Doing it
  // here from the token alone would loop for revoked sessions (token valid, session gone).

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
