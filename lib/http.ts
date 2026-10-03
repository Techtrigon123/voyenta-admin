import { NextResponse } from "next/server";

export function ok<T>(data: T, message?: string) {
  return NextResponse.json({ success: true, data, ...(message ? { message } : {}) });
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ success: false, error: { message, code } }, { status });
}

/**
 * Client IP for rate limiting and the audit log. Prefers headers the hosting platform sets itself,
 * then the right-most X-Forwarded-For entry (the one added by our own proxy).
 */
export function clientIp(headers: Headers): string {
  const platform = headers.get("cf-connecting-ip") ?? headers.get("x-vercel-forwarded-for") ?? headers.get("x-real-ip");
  if (platform) return platform.split(",")[0].trim();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? "unknown";
  return "unknown";
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}
