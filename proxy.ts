import { NextResponse, type NextRequest } from "next/server";

/**
 * First line of defence (the real checks run in every page and API route):
 * - pages without the admin session cookie go to /login;
 * - changing requests must come from this site (blocks cross-site form posts).
 */
const PUBLIC_PAGES = ["/login"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin) {
      return NextResponse.json({ success: false, error: { message: "Cross-site request blocked." } }, { status: 403 });
    }
  }

  if (pathname.startsWith("/api/")) return NextResponse.next();
  const hasSession = req.cookies.has("voyenta_admin");
  if (!hasSession && !PUBLIC_PAGES.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|voyenta-logo-mark.png).*)"],
};
