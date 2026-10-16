import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifySessionToken } from "@/lib/auth/session";
import { clientIp } from "@/lib/http";
import { checkRateLimit, findRules, retryMessage, type RateResult } from "@/lib/rate-limit";

/**
 * First line of defence (the real checks run in every page and API route):
 * - pages without the admin session cookie go to /login;
 * - API writes must come from this site and declare a small body;
 * - every API request is rate-limited (lib/rate-limit.ts).
 */
const PUBLIC_PAGES = ["/login", "/privacy", "/terms", "/cookies"];
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Every admin API takes small JSON bodies (notes, settings, decisions). */
const MAX_BODY_BYTES = 64 * 1024;

function apiError(status: number, message: string, code: string) {
  return NextResponse.json({ success: false, error: { message, code } }, { status });
}

/**
 * Reject cross-site writes. The SameSite=strict cookie already stops most CSRF;
 * this is a second layer that also covers requests carrying no cookie.
 */
function crossSite(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false; // same-origin fetches from older browsers, curl, server-to-server
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

async function limitApi(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  if (WRITE_METHODS.has(method)) {
    if (crossSite(req)) return apiError(403, "Cross-site request blocked.", "CROSS_SITE");
    // A streamed (chunked) body has no Content-Length, so the size cap below couldn't see it.
    // Browsers always send a length for fetch bodies, so only scripts are affected.
    const declared = req.headers.get("content-length");
    if (declared === null && req.headers.get("transfer-encoding")) return apiError(411, "Request body must declare its size.", "LENGTH_REQUIRED");
    const length = Number(declared ?? 0);
    if (!Number.isFinite(length) || length > MAX_BODY_BYTES) return apiError(413, "That request is too large.", "TOO_LARGE");
  }

  const rules = findRules(pathname, method);
  if (rules.length === 0) return NextResponse.next();

  const ipIdentity = `ip:${clientIp(req.headers)}`;
  let userIdentity: string | null = null;
  if (rules.some((r) => r.scope === "user")) {
    const token = req.cookies.get(COOKIE)?.value;
    const session = token ? verifySessionToken(token) : null;
    if (session?.sub) userIdentity = `user:${session.sub}`;
  }

  // Check the burst limit first, then each daily ceiling; the first one exceeded wins.
  let result: RateResult | null = null;
  for (const rule of rules) {
    const r = await checkRateLimit(rule, rule.scope === "user" ? (userIdentity ?? ipIdentity) : ipIdentity);
    if (!result) result = r; // headers describe the burst limit
    if (!r.allowed) {
      result = r;
      break;
    }
  }
  if (!result) return NextResponse.next();

  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.resetIn),
  };
  const res = result.allowed ? NextResponse.next() : apiError(429, retryMessage(result.resetIn), "RATE_LIMITED");
  if (!result.allowed) headers["Retry-After"] = String(result.resetIn);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) return limitApi(req);

  const hasSession = req.cookies.has(COOKIE);
  if (!hasSession && !PUBLIC_PAGES.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Static files that must load without a session: build assets, the image optimiser, and the public
  // logo in /brand (the login page shows it, and the optimiser fetches it without cookies).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|brand/).*)"],
};
