import { db, hasColumn } from "@/lib/db";
import { isUuid, requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

interface PaymentRow {
  id: string;
  agent_id: string;
  plan_id: string;
  amount_inr: number;
  status: string;
  reviewed_at: string | null;
  billing_cycle?: string;
}

async function loadPayment(id: string): Promise<PaymentRow | null> {
  if (!isUuid(id)) return null;
  const cols = (await hasColumn("plan_payments", "billing_cycle")) ? "id,agent_id,plan_id,amount_inr,status,reviewed_at,billing_cycle" : "id,agent_id,plan_id,amount_inr,status,reviewed_at";
  const { data } = await db().from("plan_payments").select(cols).eq("id", id).maybeSingle();
  return (data as unknown as PaymentRow | null) ?? null;
}

/** The payment proof (image or PDF), loaded only when an admin opens it. */
export async function GET(_req: Request, { params }: Ctx) {
  const { admin, response } = await requireApi("payments.view");
  if (response) return response;
  const { id } = await params;
  if (!isUuid(id)) return fail("Payment not found.", 404);
  const { data } = await db().from("plan_payments").select("proof,proof_type,payment_transaction_id").eq("id", id).maybeSingle();
  if (!data) return fail("Payment not found.", 404);
  await audit(admin, "payment.view_proof", { type: "payment", id });
  return ok(data);
}

/**
 * Body: { action: "check" | "approve" | "reject" | "refund", note?, confirmUnchecked?, revertPlan? }
 * check — sub-admins and masters: the proof matches a real UPI payment.
 * approve / reject — masters: decide (approve activates the plan through approve_plan_payment()).
 * refund — masters: record that the money was returned, optionally moving the agent back to Silver.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(req);
  const action = String(body.action ?? "");
  const note = String(body.note ?? "").trim().slice(0, 500) || null;
  const permission = action === "check" ? "payments.check" : action === "refund" ? "payments.refund" : "payments.decide";
  if (!["check", "approve", "reject", "refund"].includes(action)) return fail("Unknown action.");

  const { admin, response } = await requireApi(permission);
  if (response) return response;

  try {
    const payment = await loadPayment(id);
    if (!payment) return fail("Payment not found.", 404);
    const now = new Date().toISOString();
    const target = { type: "payment", id: payment.id };

    if (action === "check") {
      if (payment.status !== "pending") return fail(`This payment is already ${payment.status}.`, 409);
      await db().from("plan_payments").update({ reviewed_by: admin.id, reviewed_at: now, review_note: note }).eq("id", payment.id);
      await audit(admin, "payment.check", target, { agentId: payment.agent_id, note });
      return ok(true, "Marked as checked. A master admin will approve it.");
    }

    if (action === "approve") {
      if (payment.status !== "pending") return fail(`This payment is already ${payment.status}.`, 409);
      if (!payment.reviewed_at && body.confirmUnchecked !== true)
        return fail("Nobody has checked this proof yet. Confirm you've verified the payment yourself.", 409, "UNCHECKED");
      const { data, error } = await db().rpc("approve_plan_payment", { p_payment: payment.id });
      if (error) {
        if (/function .* does not exist|Could not find the function/i.test(error.message))
          return fail("Run migration 0005_billing_cycles.sql in Supabase first — it adds plan approval.", 500, "MIGRATION_MISSING");
        return fail(error.message, 400);
      }
      await db().from("plan_payments").update({ decided_by: admin.id, decided_at: now, ...(note ? { review_note: note } : {}) }).eq("id", payment.id);
      const result = (data as { expires_at: string; cycle: string }[] | null)?.[0];
      await audit(admin, "payment.approve", target, { agentId: payment.agent_id, plan: payment.plan_id, amount: payment.amount_inr, cycle: result?.cycle, expiresAt: result?.expires_at, unchecked: !payment.reviewed_at });
      return ok({ expiresAt: result?.expires_at ?? null }, "Approved — the plan is active on the agent's account.");
    }

    if (action === "reject") {
      if (payment.status !== "pending") return fail(`This payment is already ${payment.status}.`, 409);
      if (!note) return fail("Add a short reason so the team knows why it was rejected.");
      await db().from("plan_payments").update({ status: "rejected", decided_by: admin.id, decided_at: now, review_note: note }).eq("id", payment.id);
      await audit(admin, "payment.reject", target, { agentId: payment.agent_id, note });
      return ok(true, "Rejected.");
    }

    // refund
    if (payment.status !== "approved") return fail("Only approved payments can be refunded.", 409);
    if (!note) return fail("Add the refund reference or reason.");
    await db().from("plan_payments").update({ status: "refunded", refunded_at: now, decided_by: admin.id, review_note: note }).eq("id", payment.id);
    let reverted = false;
    if (body.revertPlan === true) {
      const { data: user } = await db().from("users").select("subscription_plan,subscription_expires_at").eq("id", payment.agent_id).maybeSingle();
      await db().from("users").update({ subscription_plan: "silver", subscription_expires_at: null }).eq("id", payment.agent_id);
      reverted = true;
      await audit(admin, "agent.plan_change", { type: "agent", id: payment.agent_id }, { before: user, after: { subscription_plan: "silver" }, reason: "refund" });
    }
    await audit(admin, "payment.refund", target, { agentId: payment.agent_id, amount: payment.amount_inr, note, revertedPlan: reverted });
    return ok(true, reverted ? "Refund recorded and the agent moved back to Silver." : "Refund recorded.");
  } catch (error) {
    console.error("[POST /api/payments/:id]", error);
    return fail("Could not update this payment. Please try again.", 500);
  }
}
