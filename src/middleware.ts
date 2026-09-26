import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isMaintenanceMode, MAINTENANCE_MESSAGE } from "@/lib/maintenance";

const STAFF_PREFIXES = [
  "/dashboard",
  "/equipment",
  "/facilities",
  "/contracts",
  "/technicians",
  "/quick-entry",
  "/quick-close",
  "/cm-work-orders",
  "/pm-work-orders",
  "/reports",
  "/settings",
];

function isStaffRoute(path: string): boolean {
  return STAFF_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

function isPortalRoute(path: string): boolean {
  return path === "/portal" || path.startsWith("/portal/");
}

function isPublicMarketingPath(path: string): boolean {
  return (
    path === "/" ||
    path === "/signup" ||
    path.startsWith("/signup/") ||
    path === "/pricing" ||
    path.startsWith("/pricing/")
  );
}

/**
 * When MEUT_MAINTENANCE_MODE=1|true: block public signup/marketing and checkout;
 * keep /login, NextAuth, legal pages, and authenticated app/portal working.
 * Enable/disable on Railway: set or unset MEUT_MAINTENANCE_MODE and redeploy/restart.
 */
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (isMaintenanceMode()) {
    if (path === "/api/billing/checkout") {
      return NextResponse.json(
        { error: MAINTENANCE_MESSAGE, maintenance: true },
        { status: 503 }
      );
    }

    if (isPublicMarketingPath(path)) {
      // Authenticated users hitting `/` still reach the app (home redirects).
      if (path === "/") {
        const token = await getToken({ req });
        if (!token) {
          return NextResponse.redirect(new URL("/maintenance", req.url));
        }
      } else {
        return NextResponse.redirect(new URL("/maintenance", req.url));
      }
    }
  }

  const needsAuth = isStaffRoute(path) || isPortalRoute(path);
  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = await getToken({ req });
  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  const role = token.role as string | undefined;
  if (role === "CUSTOMER" && isStaffRoute(path)) {
    return NextResponse.redirect(new URL("/portal/inventory", req.url));
  }
  if (role !== "CUSTOMER" && isPortalRoute(path)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/signup",
    "/signup/:path*",
    "/pricing",
    "/pricing/:path*",
    "/api/billing/checkout",
    "/dashboard/:path*",
    "/equipment/:path*",
    "/facilities/:path*",
    "/contracts/:path*",
    "/technicians/:path*",
    "/quick-entry",
    "/quick-entry/:path*",
    "/quick-close",
    "/quick-close/:path*",
    "/cm-work-orders/:path*",
    "/pm-work-orders/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/portal",
    "/portal/:path*",
  ],
};
