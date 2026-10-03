import { currentAdmin } from "@/lib/auth/guard";
import { clearSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { ok } from "@/lib/http";

export async function POST() {
  const current = await currentAdmin().catch(() => null);
  await clearSession();
  if (current) await audit(current.admin, "logout", { type: "admin", id: current.admin.id });
  return ok(true);
}
