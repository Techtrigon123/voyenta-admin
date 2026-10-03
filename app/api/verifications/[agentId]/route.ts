import { db } from "@/lib/db";
import { isUuid, requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import { REVIEW_COLUMNS, fingerprint, fingerprintToken, type VerificationStatus } from "@/lib/verification";

type Ctx = { params: Promise<{ agentId: string }> };

/**
 * Agent profile review.
 * Body: { action: "check" | "approve" | "deny", token, note?, confirmUnchecked? }
 * check   — sub-admins and masters (agents.verify): the details look right.
 * approve — masters (agents.approve): the agent becomes Verified and can download PDFs.
 * deny    — masters (agents.approve): the agent sees the reason, fixes their profile and resubmits.
 * `token` identifies the exact details on screen; if the agent edited anything since, nothing happens.
 */
export async function POST(req: Request, { params }: Ctx) {
  const body = await readJson(req);
  const action = String(body.action ?? "");
  if (!["check", "approve", "deny"].includes(action)) return fail("Unknown action.");
  const { admin, response } = await requireApi(action === "check" ? "agents.verify" : "agents.approve");
  if (response) return response;

  const { agentId } = await params;
  if (!isUuid(agentId)) return fail("Agent not found.", 404);
  const note = String(body.note ?? "").trim().slice(0, 500);

  try {
    const { data, error } = await db()
      .from("users")
      .select(`id,email,verification_status,${REVIEW_COLUMNS}`)
      .eq("id", agentId)
      .maybeSingle();
    if (error) {
      if (/verification_status/.test(error.message)) return fail("Run migration 0007_profile_verification.sql in Supabase first.", 500, "MIGRATION_MISSING");
      throw new Error(error.message);
    }
    const row = data as unknown as (Record<string, unknown> & { verification_status: string }) | null;
    if (!row) return fail("Agent not found.", 404);

    const status = row.verification_status as VerificationStatus;
    const fp = fingerprint(row);
    if (String(body.token ?? "") !== fingerprintToken(fp))
      return fail("The agent changed their details after you opened this review. Reload the page and review the latest details.", 409, "STALE");

    const now = new Date().toISOString();
    const target = { type: "agent", id: agentId };
    const changes = status === "changes_pending" || status === "changes_checked";

    if (action === "check") {
      if (status !== "pending" && status !== "changes_pending") return fail("This profile isn't waiting for a check.", 409);
      await db()
        .from("users")
        .update({ verification_status: changes ? "changes_checked" : "checked", verification_checked_by: admin.id, verification_checked_at: now, verification_checked_fingerprint: fp })
        .eq("id", agentId);
      if (note) await db().from("agent_notes").insert({ agent_id: agentId, admin_id: admin.id, admin_name: admin.name, body: `Profile check: ${note}` });
      await audit(admin, "agent.profile_check", target, { status, note: note || undefined });
      return ok(true, "Marked as checked. A master admin will give the final approval.");
    }

    if (!["pending", "checked", "changes_pending", "changes_checked"].includes(status)) return fail("This profile isn't waiting for a decision.", 409);

    if (action === "approve") {
      if ((status === "pending" || status === "changes_pending") && body.confirmUnchecked !== true)
        return fail("Nobody has checked these details yet. Confirm you've checked them yourself.", 409, "UNCHECKED");
      await db()
        .from("users")
        .update({
          verification_status: "approved",
          is_verified: true,
          verification_fingerprint: fp,
          verification_changes: [],
          verification_note: null,
          verification_decided_by: admin.id,
          verification_decided_at: now,
        })
        .eq("id", agentId);
      await audit(admin, "agent.profile_approve", target, { from: status, unchecked: status === "pending" || status === "changes_pending" || undefined });
      return ok(true, changes ? "Changes approved." : "Profile approved — the agent is Verified and can download PDFs.");
    }

    // deny
    if (!note) return fail("Write the reason — the agent sees it and fixes their profile.");
    await db()
      .from("users")
      .update({
        verification_status: "denied",
        is_verified: false,
        verification_fingerprint: fp,
        verification_changes: [],
        verification_note: note,
        verification_decided_by: admin.id,
        verification_decided_at: now,
      })
      .eq("id", agentId);
    await audit(admin, "agent.profile_deny", target, { from: status, reason: note });
    return ok(true, "Profile denied. The agent sees your reason; downloads stay locked until it's approved.");
  } catch (error) {
    console.error("[POST /api/verifications/:agentId]", action, error);
    return fail("Could not save the review. Please try again.", 500);
  }
}
