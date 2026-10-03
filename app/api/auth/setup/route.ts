import QRCode from "qrcode";
import { db } from "@/lib/db";
import { currentAdmin } from "@/lib/auth/guard";
import { passwordVersion, setSession } from "@/lib/auth/session";
import { decryptSecret, encryptSecret, newTotpSecret, otpauthUrl, verifyTotp } from "@/lib/auth/totp";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import { hit } from "@/lib/rate-limit";

/**
 * First sign-in: set up 2-step verification. GET creates a new secret and returns its QR code;
 * POST confirms it with a code from the app, turns 2-step on and finishes signing in.
 */
export async function GET() {
  try {
    const current = await currentAdmin();
    if (!current || current.stage !== "setup") return fail("Your sign-in expired. Start again.", 401, "UNAUTHENTICATED");
    const { admin } = current;
    // Reuse the secret from an earlier load of this screen (refresh, React re-running effects) so the
    // QR code shown always matches the one saved; only make a new one if there isn't one yet.
    const existing = admin.totp_secret ? decryptSecret(admin.totp_secret) : null;
    const secret = existing ?? newTotpSecret();
    if (!existing) await db().from("admins").update({ totp_secret: encryptSecret(secret), totp_enabled: false, totp_last_step: 0 }).eq("id", admin.id);
    const qr = await QRCode.toDataURL(otpauthUrl(secret, admin.email), { margin: 1, width: 240 });
    return ok({ qr, secret: secret.replace(/(.{4})/g, "$1 ").trim(), email: admin.email });
  } catch (error) {
    console.error("[GET /api/auth/setup]", error);
    return fail("Could not start 2-step setup. Please try again.", 500);
  }
}

export async function POST(req: Request) {
  try {
    const current = await currentAdmin();
    if (!current || current.stage !== "setup") return fail("Your sign-in expired. Start again.", 401, "UNAUTHENTICATED");
    const { admin } = current;

    const limit = await hit(`admin:totp:${admin.id}`, 5, 5 * 60);
    if (!limit.allowed) return fail("Too many wrong codes. Wait a few minutes and try again.", 429, "RATE_LIMITED");

    const code = String((await readJson(req)).code ?? "");
    const secret = admin.totp_secret ? decryptSecret(admin.totp_secret) : null;
    const step = secret ? verifyTotp(secret, code, 0) : null;
    if (step === null) return fail("That code doesn't match. Check the time on your phone and use the newest code.", 400, "INVALID_CODE");

    await db()
      .from("admins")
      .update({ totp_enabled: true, totp_last_step: step, last_login_at: new Date().toISOString() })
      .eq("id", admin.id);
    await setSession({ sub: admin.id, sv: admin.session_version, pv: passwordVersion(admin.password_hash), stage: "full" });
    await audit(admin, "admin.2fa_enabled", { type: "admin", id: admin.id });
    await audit(admin, "login.success", { type: "admin", id: admin.id });
    return ok({ next: admin.must_change_password ? "password" : "done" });
  } catch (error) {
    console.error("[POST /api/auth/setup]", error);
    return fail("Could not finish 2-step setup. Please try again.", 500);
  }
}
