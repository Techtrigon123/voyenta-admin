import { db } from "@/lib/db";
import { isUuid, requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import type { CallbackStatus } from "@/lib/support";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Handle a callback request. Body: { action, note? }
 * - schedule: { scheduledAt: ISO date-time }  → scheduled (the agent sees the booked time)
 * - complete | missed | cancel                → final status
 * - note:     { note }                         note shown to the agent
 */
export async function POST(req: Request, { params }: Ctx) {
  const { admin, response } = await requireApi("support.reply");
  if (response) return response;
  const { id } = await params;
  if (!isUuid(id)) return fail("Request not found.", 404);
  const b = await readJson(req);
  const action = String(b.action ?? "");
  const note = b.note === undefined ? undefined : String(b.note ?? "").trim().slice(0, 1000) || null;

  try {
    const { data: row } = await db().from("callback_requests").select("id,status,phone").eq("id", id).maybeSingle();
    if (!row) return fail("Request not found.", 404);
    const target = { type: "callback", id };
    const patch: Record<string, unknown> = { handled_by: admin.id, ...(note !== undefined ? { admin_note: note } : {}) };

    if (action === "schedule") {
      const at = new Date(String(b.scheduledAt ?? ""));
      if (Number.isNaN(at.getTime())) return fail("Pick a date and time for the call.");
      if (at.getTime() < Date.now() - 5 * 60_000) return fail("Pick a time in the future.");
      patch.status = "scheduled" satisfies CallbackStatus;
      patch.scheduled_at = at.toISOString();
    } else if (action === "complete" || action === "missed" || action === "cancel") {
      patch.status = (action === "complete" ? "completed" : action === "missed" ? "missed" : "cancelled") satisfies CallbackStatus;
    } else if (action !== "note") {
      return fail("Unknown action.");
    }

    const { error } = await db().from("callback_requests").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await audit(admin, `callback.${action}`, target, { before: row.status, after: patch.status ?? row.status, scheduledAt: patch.scheduled_at ?? null });
    return ok(true, action === "schedule" ? "Call scheduled. The agent can see the time." : action === "note" ? "Note saved." : "Updated.");
  } catch (error) {
    console.error("[POST /api/callbacks/:id]", error);
    return fail("Could not update the request. Please try again.", 500);
  }
}
