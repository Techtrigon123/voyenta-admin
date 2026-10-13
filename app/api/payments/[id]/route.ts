import { db, hasColumn } from "@/lib/db";
import { isUuid, requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import { lookupPayment, razorpayErrorText, RazorpayUnavailable, refundPayment, syncOrder } from "@/lib/razorpay";

type Ctx = { params: Promise<{ id: string }> };

interface PaymentRow {
  id: string;
  agent_id: string;
  plan_id: string;
  amount_inr: number;
  status: string;
  reviewed_at: string | null;
  billing_cycle?: string;
  provider?: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
}

const BASE_COLS = "id,agent_id,plan_id,amount_inr,status,reviewed_at";

async function loadPayment(id: string): Promise<PaymentRow | null> {
  if (!isUuid(id)) return null;
  const [cycles, online] = await Promise.all([hasColumn("plan_payments", "billing_cycle"), hasColumn("plan_payments", "razorpay_order_id")]);
  const cols = BASE_COLS + (cycles ? ",billing_cycle" : "") + (online ? ",provider,razorpay_order_id,razorpay_payment_id" : "");
  const { data } = await db().from("plan_payments").select(cols).eq("id", id).maybeSingle();
  return (data as unknown as PaymentRow | null) ?? null;
}

const isOnline = (p: PaymentRow) => p.provider === "razorpay";

function gatewayFail(err: unknown, what: string) {
  if (err instanceof RazorpayUnavailable) return fail(err.message, 503, "RAZORPAY_NOT_CONFIGURED");
  console.error(`[payments] ${what}`, err);
  return fail(`Razorpay: ${razorpayErrorText(err)}`, 502, "GATEWAY_ERROR");
}

/**
 * Details loaded only when an admin opens a payment:
 * - UPI proof payments: the uploaded proof (image or PDF);
 * - online payments: the live record from Razorpay (method, UPI ID / card, bank reference, fees, refunds).
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { admin, response } = await requireApi("payments.view");
  if (response) return response;
  const { id } = await params;
  const payment = await loadPayment(id);
  if (!payment) return fail("Payment not found.", 404);

  if (isOnline(payment)) {
    if (!payment.razorpay_payment_id) return ok({ kind: "online", payment: null, orderId: payment.razorpay_order_id ?? null });
    try {
      const live = await lookupPayment(payment.razorpay_payment_id);
      await audit(admin, "payment.lookup", { type: "payment", id }, { razorpayPaymentId: payment.razorpay_payment_id });
      return ok({ kind: "online", payment: live, orderId: payment.razorpay_order_id ?? null });
    } catch (err) {
      return gatewayFail(err, "lookup");
    }
  }

  const { data } = await db().from("plan_payments").select("proof,proof_type,payment_transaction_id").eq("id", id).maybeSingle();
  if (!data) return fail("Payment not found.", 404);
  await audit(admin, "payment.view_proof", { type: "payment", id });
  return ok({ kind: "proof", ...data });
}

/**
 * Body: { action: "check" | "approve" | "reject" | "refund" | "sync", note?, confirmUnchecked?, revertPlan? }
 * check — sub-admins and masters: the proof matches a real UPI payment.
 * approve / reject — masters: decide (approve activates the plan through approve_plan_payment()).
 * refund — masters: online payments are refunded through Razorpay; UPI payments record a refund made outside.
 *          Optionally moves the agent back to Silver.
 * sync — online payments the app couldn't activate: ask Razorpay and activate if it was paid.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(req);
  const action = String(body.action ?? "");
  const note = String(body.note ?? "").trim().slice(0, 500) || null;
  if (!["check", "approve", "reject", "refund", "sync"].includes(action)) return fail("Unknown action.");
  const permission = action === "check" || action === "sync" ? "payments.check" : action === "refund" ? "payments.refund" : "payments.decide";

  const { admin, response } = await requireApi(permission);
  if (response) return response;

  try {
    const payment = await loadPayment(id);
    if (!payment) return fail("Payment not found.", 404);
    const now = new Date().toISOString();
    const target = { type: "payment", id: payment.id };

    if (action === "sync") {
      if (!isOnline(payment) || !payment.razorpay_order_id) return fail("Only online payments can be synced with Razorpay.");
      if (payment.status !== "created" && payment.status !== "approved") return fail(`This payment is already ${payment.status}.`, 409);
      try {
        const result = await syncOrder(payment.razorpay_order_id);
        await audit(admin, "payment.sync", target, { agentId: payment.agent_id, orderId: payment.razorpay_order_id, ...result });
        return ok(result, result.message);
      } catch (err) {
        return gatewayFail(err, "sync");
      }
    }

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
    if (!note) return fail(isOnline(payment) ? "Add the reason for the refund." : "Add the refund reference or reason.");

    let gateway: { id: string; status: string } | null = null;
    if (isOnline(payment)) {
      if (!payment.razorpay_payment_id) return fail("This online payment has no Razorpay payment ID to refund.", 409);
      try {
        // If a previous attempt refunded on Razorpay but didn't save here, don't refund twice — just record it.
        const live = await lookupPayment(payment.razorpay_payment_id);
        // Compare with the plan price we refund, not the charged total (it can include the gateway fee).
        if (live.refundedInr >= payment.amount_inr && live.refunds[0]) gateway = { id: live.refunds[0].id, status: live.refunds[0].status };
        else gateway = await refundPayment(payment.razorpay_payment_id, payment.amount_inr, { reason: note.slice(0, 250), admin: admin.email, payment_row: payment.id });
      } catch (err) {
        return gatewayFail(err, "refund");
      }
    }

    await db()
      .from("plan_payments")
      .update({
        status: "refunded",
        refunded_at: now,
        decided_by: admin.id,
        review_note: note,
        ...(gateway ? { razorpay_refund_id: gateway.id, refund_status: gateway.status === "processed" ? "processed" : gateway.status === "failed" ? "failed" : "pending" } : {}),
      })
      .eq("id", payment.id);
    let reverted = false;
    if (body.revertPlan === true) {
      const { data: user } = await db().from("users").select("subscription_plan,subscription_expires_at").eq("id", payment.agent_id).maybeSingle();
      await db().from("users").update({ subscription_plan: "silver", subscription_expires_at: null }).eq("id", payment.agent_id);
      reverted = true;
      await audit(admin, "agent.plan_change", { type: "agent", id: payment.agent_id }, { before: user, after: { subscription_plan: "silver" }, reason: "refund" });
    }
    await audit(admin, "payment.refund", target, { agentId: payment.agent_id, amount: payment.amount_inr, note, revertedPlan: reverted, razorpayRefundId: gateway?.id ?? null });
    const done = gateway ? "Refund sent through Razorpay — it reaches the agent in 5–7 working days" : "Refund recorded";
    return ok({ razorpayRefundId: gateway?.id ?? null }, reverted ? `${done}, and the agent moved back to Silver.` : `${done}.`);
  } catch (error) {
    console.error("[POST /api/payments/:id]", error);
    return fail("Could not update this payment. Please try again.", 500);
  }
}
