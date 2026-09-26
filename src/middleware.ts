import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { FRONTEND_SESSION_COOKIE } from "@/lib/frontend-auth";
import { effectivePermissions, Permission } from "@/lib/permissions";

// Pages that require a specific permission beyond "logged in". Checked most
// specific prefix first (e.g. /reports/shifts before the plain /reports).
const PAGE_PERMISSIONS: { prefix: string; perm: Permission }[] = [
  { prefix: "/reports/shifts", perm: "shiftsHistoryView" },
  { prefix: "/dashboard", perm: "reportsView" },
  { prefix: "/reports", perm: "reportsView" },
  { prefix: "/admin/categories", perm: "categoriesManage" },
  { prefix: "/admin/udhaar", perm: "udhaarView" },
  { prefix: "/admin/settings", perm: "settingsManage" },
];
// /admin/products needs ANY of these three (create/edit/delete), not one
// specific permission -- handled separately below.
const PRODUCTS_PAGE_PERMS: Permission[] = ["productsCreate", "productsEdit", "productsDelete"];

// Pages locked to role==="admin" specifically -- not permission-toggleable.
const ADMIN_ONLY_PAGES = ["/admin/staff"];

// API method -> permission. GET is left off most of these on purpose so the
// POS can still read the catalogue; write methods are what actually change
// or remove something.
const API_METHOD_PERMISSIONS: { prefix: string; method: string; perm: Permission }[] = [
  { prefix: "/api/products", method: "POST", perm: "productsCreate" },
  { prefix: "/api/products", method: "PATCH", perm: "productsEdit" },
  { prefix: "/api/products", method: "PUT", perm: "productsEdit" },
  { prefix: "/api/products", method: "DELETE", perm: "productsDelete" },
  { prefix: "/api/categories", method: "POST", perm: "categoriesManage" },
  { prefix: "/api/categories", method: "PATCH", perm: "categoriesManage" },
  { prefix: "/api/categories", method: "DELETE", perm: "categoriesManage" },
];
// Prefixes that require a permission on every method, GET included --
// this is financial ledger data, not a public catalogue.
const API_ALL_METHODS_PERMISSIONS: { prefix: string; perm: Permission }[] = [
  { prefix: "/api/udhaar", perm: "udhaarView" },
  { prefix: "/api/settings", perm: "settingsManage" },
];
const API_ADMIN_ONLY = ["/api/users", "/api/settings/backup"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPage =
    pathname === "/" ||
    pathname.startsWith("/pos") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/customer-loyalty") ||
    pathname.startsWith("/change-pin");
  // Protect all API routes except the auth endpoints (login/logout/session).
  const isApi = pathname.startsWith("/api") && !pathname.startsWith("/api/auth");

  if (!isPage && !isApi) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(FRONTEND_SESSION_COOKIE);
    return response;
  }

  // First boot / PIN reset: nothing else is reachable until a new PIN is set.
  if (session.mustChangePin) {
    if (isApi) {
      if (!pathname.startsWith("/api/settings/pin")) {
        return NextResponse.json({ error: "PIN change required", mustChangePin: true }, { status: 403 });
      }
    } else if (pathname !== "/change-pin") {
      return NextResponse.redirect(new URL("/change-pin", req.url));
    }
    return NextResponse.next();
  }

  const perms = effectivePermissions(session.role, session.permissions);
  const isAdminRole = session.role === "admin";

  if (isPage) {
    if (ADMIN_ONLY_PAGES.some((p) => pathname.startsWith(p)) && !isAdminRole) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (pathname.startsWith("/admin/products") && !PRODUCTS_PAGE_PERMS.some((p) => perms.includes(p))) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    const rule = PAGE_PERMISSIONS.find((r) => pathname.startsWith(r.prefix));
    if (rule && !perms.includes(rule.perm)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (isApi) {
    if (API_ADMIN_ONLY.some((p) => pathname.startsWith(p)) && !isAdminRole) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    const allMethodsRule =
      pathname === "/api/settings/pin"
        ? undefined
        : API_ALL_METHODS_PERMISSIONS.find((r) => pathname.startsWith(r.prefix));
    if (allMethodsRule && !perms.includes(allMethodsRule.perm)) {
      return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
    }
    const methodRule = API_METHOD_PERMISSIONS.find(
      (r) => pathname.startsWith(r.prefix) && req.method === r.method
    );
    if (methodRule && !perms.includes(methodRule.perm)) {
      return NextResponse.json({ error: "You don't have access to this" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/pos/:path*",
    "/admin/:path*",
    "/dashboard/:path*",
    "/reports/:path*",
    "/orders/:path*",
    "/customer-loyalty/:path*",
    "/change-pin",
    "/api/:path*",
    "/login",
  ],
};
