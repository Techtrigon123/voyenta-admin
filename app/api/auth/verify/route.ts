import { db } from "@/lib/db";
import { currentAdmin } from "@/lib/auth/guard";
import { passwordVersion, setSession } from "@/lib/auth/session";
import { decryptSecret, verifyTotp } from "@/lib/auth/totp";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import { hit } from "@/lib/rate-limit";

/** Step 2 of sign-in: the 6-digit code from the admin's authenticator app. */
export async function POST(req: Request) {
  try {
    const current = await currentAdmin();
    if (!current || current.stage !== "2fa") return fail("Your sign-in expired. Start again.", 401, "UNAUTHENTICATED");
    const { admin } = current;

    const limit = await hit(`admin:totp:${admin.id}`, 5, 5 * 60);
    if (!limit.allowed) return fail("Too many wrong codes. Wait a few minutes and try again.", 429, "RATE_LIMITED");

    const code = String((await readJson(req)).code ?? "");
    const secret = admin.totp_secret ? decryptSecret(admin.totp_secret) : null;
    const step = secret ? verifyTotp(secret, code, admin.totp_last_step) : null;
    if (step === null) {
      await audit(admin, "login.failed", { type: "admin", id: admin.id }, { reason: "wrong_2fa_code" });
      return fail("That code is wrong or expired. Use the newest code in your app.", 400, "INVALID_CODE");
    }

    await db().from("admins").update({ totp_last_step: step, last_login_at: new Date().toISOString() }).eq("id", admin.id);
    await setSession({ sub: admin.id, sv: admin.session_version, pv: passwordVersion(admin.password_hash), stage: "full" });
    await audit(admin, "login.success", { type: "admin", id: admin.id });
    return ok({ next: admin.must_change_password ? "password" : "done" });
  } catch (error) {
    console.error("[POST /api/auth/verify]", error);
    return fail("Could not check the code. Please try again.", 500);
  }
}
