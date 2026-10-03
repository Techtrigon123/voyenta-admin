import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/http";

/**
 * Records an admin action in the append-only audit log. Never throws: a logging failure is
 * reported to the server log but doesn't undo the action that already happened.
 */
export async function audit(
  admin: { id: string; email: string } | null,
  action: string,
  target?: { type: string; id?: string | null },
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    const ip = clientIp(await headers());
    const { error } = await db().from("admin_audit_log").insert({
      admin_id: admin?.id ?? null,
      admin_email: admin?.email ?? (typeof details.email === "string" ? details.email : null),
      action,
      target_type: target?.type ?? null,
      target_id: target?.id ?? null,
      details,
      ip,
    });
    if (error) console.error("[audit] could not record", action, error.message);
  } catch (e) {
    console.error("[audit] could not record", action, (e as Error).message);
  }
}
