import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireApi } from "@/lib/auth/guard";
import { passwordVersion, setSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import { passwordProblem } from "@/lib/password";

/** Change your own password (also used to replace a temporary password on first sign-in). */
export async function POST(req: Request) {
  try {
    const { admin, response } = await requireApi(undefined, { allowPasswordChange: true });
    if (response) return response;
    const body = await readJson(req);
    const current = String(body.current ?? "").trim();
    const next = String(body.next ?? "");

    if (!(await bcrypt.compare(current, admin.password_hash))) return fail("Your current password is wrong.", 400);
    const problem = passwordProblem(next, admin.email);
    if (problem) return fail(problem, 400);
    if (await bcrypt.compare(next, admin.password_hash)) return fail("Choose a password you haven't used here.", 400);

    const hash = await bcrypt.hash(next, 12);
    await db().from("admins").update({ password_hash: hash, must_change_password: false }).eq("id", admin.id);
    // The new password signs out every other session; keep this one signed in.
    await setSession({ sub: admin.id, sv: admin.session_version, pv: passwordVersion(hash), stage: "full" });
    await audit(admin, "admin.password_changed", { type: "admin", id: admin.id });
    return ok(true, "Password updated.");
  } catch (error) {
    console.error("[POST /api/account/password]", error);
    return fail("Could not update the password. Please try again.", 500);
  }
}
