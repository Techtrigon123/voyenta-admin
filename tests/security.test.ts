import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

// Nothing here touches the database or real cookies.
vi.mock("@/lib/db", () => ({ db: () => ({}) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));

const SECRET = "unit-test-admin-session-secret-at-least-32-chars";
process.env.ADMIN_SESSION_SECRET = SECRET;

const { clientIp, readJson } = await import("@/lib/http");
const { findRules, retryMessage } = await import("@/lib/rate-limit");
const { verifySessionToken, passwordVersion, COOKIE } = await import("@/lib/auth/session");

const ids = (path: string, method: string) => findRules(path, method).map((r) => r.id);

describe("rate-limit rules", () => {
  it("limits sign-in per IP in the database", () => {
    expect(findRules("/api/auth/login", "POST")[0]).toMatchObject({ id: "auth:login", limit: 10, store: "db", scope: "ip" });
  });

  it("limits the 2-step code endpoints", () => {
    expect(ids("/api/auth/verify", "POST")[0]).toBe("auth:2fa");
    expect(ids("/api/auth/setup", "POST")[0]).toBe("auth:2fa");
  });

  it("adds a daily ceiling on payment actions (approve, refund, sync…)", () => {
    expect(ids("/api/payments/abc", "POST")).toEqual(["api", "day:payments"]);
  });

  it("caps data exports hard", () => {
    expect(findRules("/api/agents/abc/export", "GET")[0]).toMatchObject({ id: "export", limit: 5 });
  });

  it("never limits CORS preflight requests", () => {
    expect(findRules("/api/auth/login", "OPTIONS")).toEqual([]);
  });

  it("explains waits in seconds, minutes, or hours for daily limits", () => {
    expect(retryMessage(45)).toMatch(/45 seconds/);
    expect(retryMessage(900)).toMatch(/15 minutes/);
    expect(retryMessage(20 * 3600)).toMatch(/today's limit/);
  });
});

describe("clientIp", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the right-most X-Forwarded-For entry, not one the client chose", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("on Vercel, trusts only Vercel's header", () => {
    vi.stubEnv("VERCEL", "1");
    expect(clientIp(new Headers({ "cf-connecting-ip": "6.6.6.6", "x-vercel-forwarded-for": "7.7.7.7" }))).toBe("7.7.7.7");
  });
});

describe("readJson", () => {
  const req = (body: string) => new Request("http://x/api", { method: "POST", body, headers: { "content-type": "application/json" } });

  it("returns the object for valid JSON", async () => {
    expect(await readJson(req('{"action":"approve"}'))).toEqual({ action: "approve" });
  });

  it("returns an empty object for broken JSON, arrays and plain values", async () => {
    expect(await readJson(req("{not json"))).toEqual({});
    expect(await readJson(req("[1,2]"))).toEqual({});
    expect(await readJson(req('"text"'))).toEqual({});
  });
});

describe("admin session tokens", () => {
  const session = { sub: "admin-1", sv: 1, pv: "abc", stage: "full" as const };
  const sign = (payload: object, secret = SECRET, opts: jwt.SignOptions = {}) =>
    jwt.sign(payload, secret, { algorithm: "HS256", audience: "vouchlio-admin", expiresIn: 60, ...opts });

  it("uses its own cookie name, separate from the agent app", () => {
    expect(COOKIE).toBe("vouchlio_admin");
  });

  it("accepts a token signed with the admin secret", () => {
    expect(verifySessionToken(sign(session))).toMatchObject(session);
  });

  it("rejects a token signed with any other secret (e.g. the agent app's)", () => {
    expect(verifySessionToken(sign(session, "a-different-secret-of-sufficient-length-123"))).toBeNull();
  });

  it("rejects agent-app tokens that lack the admin audience", () => {
    expect(verifySessionToken(jwt.sign(session, SECRET, { algorithm: "HS256", expiresIn: 60 }))).toBeNull();
  });

  it("rejects expired, tampered and unsigned tokens", () => {
    expect(verifySessionToken(sign(session, SECRET, { expiresIn: -10 }))).toBeNull();
    const [h, , s] = sign(session).split(".");
    const forged = Buffer.from(JSON.stringify({ ...session, sub: "someone-else" })).toString("base64url");
    expect(verifySessionToken(`${h}.${forged}.${s}`)).toBeNull();
    expect(verifySessionToken(jwt.sign(session, "", { algorithm: "none" } as jwt.SignOptions))).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();
  });

  it("changing the password changes the fingerprint, signing out old sessions", () => {
    expect(passwordVersion("$2a$12$hashA")).not.toBe(passwordVersion("$2a$12$hashB"));
    expect(passwordVersion("$2a$12$hashA")).toBe(passwordVersion("$2a$12$hashA"));
  });
});
