import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { findAdminByEmail, requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import { temporaryPassword } from "@/lib/password";
import { cleanSubPermissions } from "@/lib/permissions";

/**
 * Master only: create a sub-admin. Returns a temporary password ONCE — the new admin must replace
 * it and set up 2-step verification when they first sign in. New masters can only be created with
 * the create-master script, never from the portal.
 */
export async function POST(req: Request) {
  const { admin, response } = await requireApi("admins.manage");
  if (response) return response;
  const body = await readJson(req);
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const permissions = cleanSubPermissions(body.permissions);

  if (!name || name.length > 100) return fail("Enter the admin's name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return fail("Enter a valid email address.");
  if (!permissions.length) return fail("Give the sub-admin at least one permission.");
  if (await findAdminByEmail(email)) return fail("An admin with this email already exists.", 409);

  try {
    const password = temporaryPassword();
    const { data, error } = await db()
      .from("admins")
      .insert({ name, email, role: "sub", permissions, password_hash: await bcrypt.hash(password, 12), must_change_password: true, created_by: admin.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(admin, "admin.create", { type: "admin", id: data.id }, { email, name, permissions });
    return ok({ id: data.id, temporaryPassword: password }, "Sub-admin created.");
  } catch (error) {
    console.error("[POST /api/admins]", error);
    return fail("Could not create the admin. Please try again.", 500);
  }
}
