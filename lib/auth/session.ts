import "server-only";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { cookies } from "next/headers";

/**
 * Admin sessions: a signed cookie, separate from the Voyenta app's agent cookie and signed with a
 * different secret, so an agent token can never pass as an admin token.
 *
 * Stages: "2fa" — password OK, waiting for the 6-digit code · "setup" — password OK, must set up
 * 2-step verification · "full" — signed in. Every request re-reads the admin from the database,
 * so disabling an admin, changing permissions or resetting a password applies immediately.
 */

export const COOKIE = "voyenta_admin";
const FULL_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const PENDING_TTL_SECONDS = 10 * 60; // 10 minutes to finish 2-step verification

export type Stage = "2fa" | "setup" | "full";

export interface AdminSession {
  sub: string; // admin id
  sv: number; // session_version at sign-in
  pv: string; // password fingerprint at sign-in
  stage: Stage;
}

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("ADMIN_SESSION_SECRET is missing or shorter than 32 characters.");
  return s;
}

/** Short fingerprint of the password hash: a new password invalidates older sessions. */
export function passwordVersion(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

export async function setSession(session: AdminSession): Promise<void> {
  const ttl = session.stage === "full" ? FULL_TTL_SECONDS : PENDING_TTL_SECONDS;
  const token = jwt.sign(session, secret(), { algorithm: "HS256", expiresIn: ttl, audience: "voyenta-admin" });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ttl,
  });
}

export async function readSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, secret(), { algorithms: ["HS256"], audience: "voyenta-admin" }) as AdminSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
