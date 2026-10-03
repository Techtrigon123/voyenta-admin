import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { findAdminById, isUuid, requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import { temporaryPassword } from "@/lib/password";
import { cleanSubPermissions } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Master only: manage one sub-admin.
 * Body: { action: "permissions", permissions } | { action: "disable" | "enable" | "reset_password" | "reset_2fa" }
 * Master accounts can't be changed here. Disabling and resets sign the admin out everywhere.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { admin, response } = await requireApi("admins.manage");
  if (response) return response;
  const { id } = await params;
  if (!isUuid(id)) return fail("Admin not found.", 404);
  const body = await readJson(req);
  const action = String(body.action ?? "");

  try {
    const target = await findAdminById(id);
    if (!target) return fail("Admin not found.", 404);
    if (target.role === "master") return fail("Master accounts can't be changed from the portal.", 403);
    const ref = { type: "admin", id: target.id };
    const signOut = { session_version: target.session_version + 1 };

    switch (action) {
      case "permissions": {
        const permissions = cleanSubPermissions(body.permissions);
        if (!permissions.length) return fail("Leave at least one permission, or disable the admin instead.");
        await db().from("admins").update({ permissions }).eq("id", target.id);
        await audit(admin, "admin.permissions", ref, { before: target.permissions, after: permissions });
        return ok(true, "Permissions updated.");
      }
      case "disable":
        await db().from("admins").update({ disabled: true, ...signOut }).eq("id", target.id);
        await audit(admin, "admin.disable", ref, { email: target.email });
        return ok(true, "Admin disabled and signed out.");
      case "enable":
        await db().from("admins").update({ disabled: false }).eq("id", target.id);
        await audit(admin, "admin.enable", ref, { email: target.email });
        return ok(true, "Admin enabled.");
      case "reset_password": {
        const password = temporaryPassword();
        await db()
          .from("admins")
          .update({ password_hash: await bcrypt.hash(password, 12), must_change_password: true, ...signOut })
          .eq("id", target.id);
        await audit(admin, "admin.reset_password", ref, { email: target.email });
        return ok({ temporaryPassword: password }, "Temporary password created.");
      }
      case "reset_2fa":
        await db().from("admins").update({ totp_secret: null, totp_enabled: false, totp_last_step: 0, ...signOut }).eq("id", target.id);
        await audit(admin, "admin.reset_2fa", ref, { email: target.email });
        return ok(true, "2-step verification reset. They'll set it up again at their next sign-in.");
    }
    return fail("Unknown action.");
  } catch (error) {
    console.error("[POST /api/admins/:id]", action, error);
    return fail("Could not update the admin. Please try again.", 500);
  }
}
