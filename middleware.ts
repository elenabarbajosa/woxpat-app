import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPath = pathname.startsWith("/admin");
  const isRootPath = pathname === "/";
  const isLoginPath = pathname === "/admin/login";

  if ((!isAdminPath && !isRootPath) || isLoginPath) {
    return NextResponse.next();
  }

  const isLoggedIn = request.cookies.get("woxpat_admin_session")?.value === "active";
  if (isLoggedIn) {
    if (pathname === "/admin") {
      const rootUrl = new URL("/", request.url);
      return NextResponse.redirect(rootUrl);
    }
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
