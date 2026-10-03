import "server-only";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { can, type Permission, type Role } from "@/lib/permissions";
import { passwordVersion, readSession, type Stage } from "./session";

export interface AdminRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: string[];
  password_hash: string;
  totp_secret: string | null;
  totp_enabled: boolean;
  totp_last_step: number;
  must_change_password: boolean;
  disabled: boolean;
  session_version: number;
  last_login_at: string | null;
  created_at: string;
}

/** What the screens may know about the signed-in admin (no hashes or secrets). */
export interface AdminView {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: string[];
}

export const toView = (a: AdminRecord): AdminView => ({ id: a.id, email: a.email, name: a.name, role: a.role, permissions: a.permissions ?? [] });

export async function findAdminById(id: string): Promise<AdminRecord | null> {
  const { data } = await db().from("admins").select("*").eq("id", id).maybeSingle();
  return (data as AdminRecord | null) ?? null;
}

export async function findAdminByEmail(email: string): Promise<AdminRecord | null> {
  const { data } = await db().from("admins").select("*").eq("email", email.trim().toLowerCase()).maybeSingle();
  return (data as AdminRecord | null) ?? null;
}

/** The admin behind the session cookie, if the session is still valid. */
export async function currentAdmin(): Promise<{ admin: AdminRecord; stage: Stage } | null> {
  const session = await readSession();
  if (!session) return null;
  const admin = await findAdminById(session.sub);
  if (!admin || admin.disabled) return null;
  if (admin.session_version !== session.sv) return null;
  if (passwordVersion(admin.password_hash) !== session.pv) return null;
  return { admin, stage: session.stage };
}

/**
 * For pages: signed in fully, password changed, and (optionally) holding a permission.
 * Otherwise redirects to sign-in, the forced password change, or the "no access" page.
 */
export async function requirePage(permission?: Permission, opts: { allowPasswordChange?: boolean } = {}): Promise<AdminRecord> {
  const current = await currentAdmin();
  if (!current || current.stage !== "full") redirect("/login");
  const { admin } = current;
  if (admin.must_change_password && !opts.allowPasswordChange) redirect("/account?first=1");
  if (permission && !can(admin, permission)) redirect("/denied");
  return admin;
}

/** For API routes: same checks, answered as JSON errors. */
export async function requireApi(
  permission?: Permission,
  opts: { allowPasswordChange?: boolean } = {}
): Promise<{ admin: AdminRecord; response?: never } | { admin?: never; response: NextResponse }> {
  const current = await currentAdmin();
  if (!current || current.stage !== "full") return { response: fail("Please sign in again.", 401, "UNAUTHENTICATED") };
  const { admin } = current;
  if (admin.must_change_password && !opts.allowPasswordChange)
    return { response: fail("Set a new password first.", 403, "PASSWORD_CHANGE_REQUIRED") };
  if (permission && !can(admin, permission)) return { response: fail("You don't have access to this.", 403, "FORBIDDEN") };
  return { admin };
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
