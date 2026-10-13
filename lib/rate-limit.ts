import "server-only";
import { db } from "@/lib/db";

/**
 * API rate limiting, modelled on the Vouchlio app's lib/rate-limit.ts.
 *
 * - proxy.ts applies RATE_RULES to every /api request: a burst limit (the first matching rule)
 *   plus every matching daily ceiling.
 * - "db" rules keep counters in the shared rate_limits table (migration 0002), so they hold across
 *   restarts and server instances. "memory" rules count in this server process only: fast, no
 *   extra database round trip, good enough for throttling general traffic.
 * - Unlike the Vouchlio app, db rules FAIL CLOSED here: if the counter can't be reached the request
 *   is refused, never let through unlimited. The portal can't work without the database anyway.
 * - Routes add their own finer limits with hit() where the proxy can't see enough (the email in a
 *   login body, the action in an agent update).
 */

export interface RateRule {
  id: string;
  /** Matches the request path and method. */
  test: (path: string, method: string) => boolean;
  limit: number;
  windowSeconds: number;
  store: "db" | "memory";
  /** Count per signed-in admin when possible, otherwise per client IP. */
  scope: "ip" | "user";
  /** Daily ceiling: checked in addition to the burst rule. */
  extra?: boolean;
}

const MINUTE = 60;
const FIFTEEN_MIN = 15 * 60;
const DAY = 24 * 60 * 60;

const post = (m: string) => m === "POST";
const daily = (id: string, test: RateRule["test"], limit: number): RateRule => ({ id: `day:${id}`, test, limit, windowSeconds: DAY, store: "db", scope: "user", extra: true });

/**
 * Daily ceilings per admin. Far above a normal day's work, but they cap the damage a stolen
 * session or a runaway script can do (mass changes, mass exports, mass emails).
 */
const DAILY_RULES: RateRule[] = [
  daily("agents", (p, m) => /^\/api\/agents\/[^/]+$/.test(p) && post(m), 400),
  daily("export", (p) => /^\/api\/agents\/[^/]+\/export$/.test(p), 50),
  daily("payments", (p, m) => /^\/api\/payments\/[^/]+$/.test(p) && post(m), 400),
  daily("payment-proofs", (p, m) => /^\/api\/payments\/[^/]+$/.test(p) && m === "GET", 1000),
  daily("verifications", (p, m) => /^\/api\/verifications\/[^/]+$/.test(p) && post(m), 400),
  daily("support", (p, m) => /^\/api\/support\/[^/]+$/.test(p) && post(m), 300),
  daily("contact", (p, m) => /^\/api\/contact\/[^/]+$/.test(p) && post(m), 300),
  daily("tickets", (p, m) => /^\/api\/tickets\/[^/]+$/.test(p) && post(m), 600),
  daily("callbacks", (p, m) => /^\/api\/callbacks\/[^/]+$/.test(p) && post(m), 300),
  daily("admins:create", (p, m) => p === "/api/admins" && post(m), 20),
  daily("admins:update", (p, m) => /^\/api\/admins\/[^/]+$/.test(p) && post(m), 100),
  daily("settings", (p, m) => p === "/api/settings" && post(m), 100),
];

export const RATE_RULES: RateRule[] = [
  // Sign-in steps, per IP. The login route also limits per IP and per email (the proxy can't see
  // the email), and the 2-step routes limit per admin.
  { id: "auth:login", test: (p, m) => p === "/api/auth/login" && post(m), limit: 10, windowSeconds: FIFTEEN_MIN, store: "db", scope: "ip" },
  { id: "auth:2fa", test: (p, m) => (p === "/api/auth/verify" || p === "/api/auth/setup") && post(m), limit: 15, windowSeconds: FIFTEEN_MIN, store: "db", scope: "ip" },
  { id: "auth:setup", test: (p, m) => p === "/api/auth/setup" && m === "GET", limit: 10, windowSeconds: FIFTEEN_MIN, store: "db", scope: "ip" },
  { id: "auth:change-password", test: (p, m) => p === "/api/account/password" && post(m), limit: 5, windowSeconds: FIFTEEN_MIN, store: "db", scope: "user" },
  // Expensive or sensitive.
  { id: "export", test: (p) => /^\/api\/agents\/[^/]+\/export$/.test(p), limit: 5, windowSeconds: MINUTE, store: "memory", scope: "user" },
  { id: "admins", test: (p, m) => p.startsWith("/api/admins") && post(m), limit: 10, windowSeconds: MINUTE, store: "memory", scope: "user" },
  // Everything else under /api: generous for real work, stops floods.
  { id: "api", test: (p) => p.startsWith("/api/"), limit: 120, windowSeconds: MINUTE, store: "memory", scope: "user" },
  ...DAILY_RULES,
];

/** The first matching burst rule, plus every matching daily ceiling. */
export function findRules(path: string, method: string): RateRule[] {
  if (method === "OPTIONS") return [];
  const primary = RATE_RULES.find((r) => !r.extra && r.test(path, method));
  const extras = RATE_RULES.filter((r) => r.extra && r.test(path, method));
  return primary ? [primary, ...extras] : extras;
}

export interface RateResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  resetIn: number;
}

/* ─── in-memory store (survives dev hot reloads via globalThis) ──────────── */

type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __adminRateBuckets?: Map<string, Bucket> };
const buckets = (g.__adminRateBuckets ??= new Map<string, Bucket>());

function hitMemory(key: string, limit: number, windowSeconds: number): RateResult {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowSeconds * 1000 };
    buckets.set(key, b);
  }
  b.count += 1;
  return { allowed: b.count <= limit, limit, remaining: Math.max(0, limit - b.count), resetIn: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

/** Counts one attempt in the shared rate_limits table. Fails closed if the counter can't be reached. */
async function hitDb(key: string, limit: number, windowSeconds: number): Promise<RateResult> {
  try {
    const { data, error } = await db().rpc("rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    const row = (data as { allowed: boolean; remaining: number; reset_at: string }[] | null)?.[0];
    if (error || !row) throw new Error(error?.message ?? "rate_limit_hit returned no row");
    return {
      allowed: row.allowed,
      limit,
      remaining: row.remaining,
      resetIn: Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000)),
    };
  } catch (e) {
    console.error("[rate-limit] counter unavailable, refusing request:", (e as Error).message);
    return { allowed: false, limit, remaining: 0, resetIn: windowSeconds };
  }
}

export function checkRateLimit(rule: RateRule, identity: string): Promise<RateResult> | RateResult {
  const key = `admin:${rule.id}:${identity}`;
  return rule.store === "db" ? hitDb(key, rule.limit, rule.windowSeconds) : hitMemory(key, rule.limit, rule.windowSeconds);
}

/** For limits checked inside a route (per email, per admin, per action). Fails closed. */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; resetIn: number }> {
  const r = await hitDb(key, limit, windowSeconds);
  return { allowed: r.allowed, resetIn: r.resetIn };
}

export async function clearKey(key: string): Promise<void> {
  await db().from("rate_limits").delete().eq("key", key);
}

export function retryMessage(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (seconds < 90) return `Too many requests. Please wait ${seconds} seconds and try again.`;
  if (minutes < 120) return `Too many requests. Please wait ${minutes} minutes and try again.`;
  return `You've reached today's limit for this action. Please try again in ${Math.ceil(minutes / 60)} hours, or ask a master admin.`;
}
