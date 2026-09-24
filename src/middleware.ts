import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { FRONTEND_SESSION_COOKIE } from "@/lib/frontend-auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPage =
    pathname === "/" ||
    pathname.startsWith("/pos") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/customer-loyalty");
  // Protect all API routes except the auth endpoints (login/logout/session).
  const isApi = pathname.startsWith("/api") && !pathname.startsWith("/api/auth");

  if (!isPage && !isApi) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const frontendSession = req.cookies.get(FRONTEND_SESSION_COOKIE)?.value === "true";

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear stale frontend session if any
    response.cookies.delete(FRONTEND_SESSION_COOKIE);
    return response;
  }

  // Admin area and Reports are for managers/admins only — cashiers stay on the counter.
  if ((pathname.startsWith("/admin") || pathname.startsWith("/reports")) && session?.role === "cashier") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/pos/:path*", "/admin/:path*", "/dashboard/:path*", "/reports/:path*", "/orders/:path*", "/customers/:path*", "/customer-loyalty/:path*", "/api/:path*", "/login"],
};
