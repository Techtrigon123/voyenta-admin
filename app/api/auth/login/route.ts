import bcrypt from "bcryptjs";
import { findAdminByEmail } from "@/lib/auth/guard";
import { passwordVersion, setSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import { hit } from "@/lib/rate-limit";

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
let dummyHash: string | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("vouchlio-admin-dummy-password", 12));
const GENERIC = "Wrong email or password.";

/** Step 1 of sign-in: email + password. Next step is the 2-step code (or setting it up). */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    // Spaces around a pasted password are dropped (passwords may not start or end with one — lib/password.ts).
    const password = String(body.password ?? "").trim();
    if (!email || !password || email.length > 200 || password.length > 200) return fail(GENERIC, 400);

    // Per IP is limited in proxy.ts; per account here, so it still holds if an attacker rotates IPs.
    const byEmail = await hit(`admin:login:email:${email}`, 8, 15 * 60);
    if (!byEmail.allowed) {
      const wait = Math.ceil(byEmail.resetIn / 60);
      return fail(`Too many attempts. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`, 429, "RATE_LIMITED");
    }

    const admin = await findAdminByEmail(email);
    const valid = await bcrypt.compare(password, admin?.password_hash ?? getDummyHash());
    if (!admin || !valid || admin.disabled) {
      await audit(null, "login.failed", { type: "admin", id: admin?.id ?? null }, { email, reason: !admin ? "unknown_email" : admin.disabled ? "disabled" : "wrong_password" });
      return fail(GENERIC, 401, "INVALID_LOGIN");
    }

    const stage = admin.totp_enabled ? "2fa" : "setup";
    await setSession({ sub: admin.id, sv: admin.session_version, pv: passwordVersion(admin.password_hash), stage });
    return ok({ next: stage });
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return fail("Sign-in is unavailable right now. Please try again.", 500);
  }
}
