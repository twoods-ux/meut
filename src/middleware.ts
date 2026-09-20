import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const STAFF_PREFIXES = [
  "/dashboard",
  "/equipment",
  "/facilities",
  "/contracts",
  "/technicians",
  "/cm-work-orders",
  "/pm-work-orders",
  "/reports",
  "/settings",
];

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const path = req.nextUrl.pathname;
    const isPortal = path === "/portal" || path.startsWith("/portal/");
    const isStaffRoute = STAFF_PREFIXES.some(
      (p) => path === p || path.startsWith(p + "/")
    );

    if (role === "CUSTOMER" && isStaffRoute) {
      return NextResponse.redirect(new URL("/portal/inventory", req.url));
    }
    if (role !== "CUSTOMER" && isPortal) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/equipment/:path*",
    "/facilities/:path*",
    "/contracts/:path*",
    "/technicians/:path*",
    "/cm-work-orders/:path*",
    "/pm-work-orders/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/portal",
    "/portal/:path*",
  ],
};
