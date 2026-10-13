import "server-only";
import Razorpay from "razorpay";
import { db } from "@/lib/db";

/**
 * Razorpay for admins: look up payments, issue refunds and finish payments the app couldn't activate.
 * Uses the same RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET as the Vouchlio app (checkin-app/lib/payments/razorpay.ts).
 */

export const isRazorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());

let client: Razorpay | null = null;
function razorpay(): Razorpay {
  if (!isRazorpayConfigured()) throw new RazorpayUnavailable();
  client ??= new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID!.trim(), key_secret: process.env.RAZORPAY_KEY_SECRET!.trim() });
  return client;
}

export class RazorpayUnavailable extends Error {
  constructor() {
    super("Razorpay keys aren't set on the admin portal (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  }
}

/** Human-readable message from a Razorpay SDK error. */
export function razorpayErrorText(err: unknown): string {
  const e = err as { error?: { description?: string } } | null;
  return e?.error?.description ?? (err instanceof Error ? err.message : "Razorpay request failed.");
}

const rupees = (paise: unknown) => Math.round(Number(paise ?? 0)) / 100;

export interface PaymentLookup {
  id: string;
  orderId: string | null;
  status: string;
  method: string;
  amountInr: number;
  feeInr: number | null;
  taxInr: number | null;
  refundedInr: number;
  refundStatus: string | null;
  captured: boolean;
  email: string | null;
  contact: string | null;
  /** The detail that identifies the payment on a statement: UPI ID, card network + last 4, bank or wallet. */
  instrument: string | null;
  /** Bank reference (RRN / UTR) when Razorpay has it. */
  bankReference: string | null;
  error: string | null;
  createdAt: string;
  refunds: { id: string; amountInr: number; status: string; createdAt: string }[];
}

export async function lookupPayment(paymentId: string): Promise<PaymentLookup> {
  const rzp = razorpay();
  const [p, refunds] = await Promise.all([
    rzp.payments.fetch(paymentId, { "expand[]": "card" } as never),
    rzp.payments.fetchMultipleRefund(paymentId).catch(() => ({ items: [] })),
  ]);
  const card = (p as unknown as { card?: { network?: string; last4?: string } }).card;
  const acquirer = (p as unknown as { acquirer_data?: Record<string, string | null> }).acquirer_data ?? {};
  const instrument = p.vpa ?? (card?.last4 ? `${card.network ?? "Card"} •••• ${card.last4}` : null) ?? p.bank ?? p.wallet ?? null;
  return {
    id: p.id,
    orderId: p.order_id ?? null,
    status: p.status,
    method: String(p.method ?? ""),
    amountInr: rupees(p.amount),
    feeInr: p.fee != null ? rupees(p.fee) : null,
    taxInr: p.tax != null ? rupees(p.tax) : null,
    refundedInr: rupees(p.amount_refunded),
    refundStatus: p.refund_status && p.refund_status !== "null" ? p.refund_status : null,
    captured: Boolean(p.captured),
    email: p.email ? String(p.email) : null,
    contact: p.contact ? String(p.contact) : null,
    instrument,
    bankReference: acquirer.rrn ?? acquirer.upi_transaction_id ?? acquirer.bank_transaction_id ?? null,
    error: p.error_description ? String(p.error_description) : null,
    createdAt: new Date(Number(p.created_at) * 1000).toISOString(),
    refunds: ((refunds as { items?: { id: string; amount: number; status: string; created_at: number }[] }).items ?? []).map((r) => ({
      id: r.id,
      amountInr: rupees(r.amount),
      status: r.status,
      createdAt: new Date(r.created_at * 1000).toISOString(),
    })),
  };
}

/** Full refund through Razorpay. Returns the refund id and its first status (usually "processed" or "pending"). */
export async function refundPayment(paymentId: string, amountInr: number, notes: Record<string, string>): Promise<{ id: string; status: string }> {
  const r = await razorpay().payments.refund(paymentId, { amount: Math.round(amountInr * 100), speed: "normal", notes });
  return { id: r.id, status: r.status };
}

/**
 * Finish an order the app never activated (tab closed before the callback and the webhook failed or isn't set up).
 * Asks Razorpay for the order's payments; if one was captured (or authorized — it's captured here), activates the plan
 * with the same database function the app uses, so a later webhook changes nothing.
 */
export async function syncOrder(orderId: string): Promise<{ activated: boolean; paymentId: string | null; message: string }> {
  const rzp = razorpay();
  const { items } = await rzp.orders.fetchPayments(orderId);
  let paid = items.find((p) => p.status === "captured");
  if (!paid) {
    const authorized = items.find((p) => p.status === "authorized");
    if (authorized) paid = await rzp.payments.capture(authorized.id, Number(authorized.amount), "INR");
  }
  if (!paid) {
    const failed = items.filter((p) => p.status === "failed").length;
    return {
      activated: false,
      paymentId: null,
      message: items.length === 0 ? "No payment was attempted on this order." : `No successful payment on this order (${failed} failed attempt${failed === 1 ? "" : "s"}).`,
    };
  }
  // Check against the order (our plan price). The payment can be higher by the gateway fee when
  // "customer fee bearer" is on, but never lower.
  const order = await rzp.orders.fetch(orderId);
  if (Number(paid.amount) < Number(order.amount)) throw new Error(`Payment ${paid.id} (${paid.amount} paise) is less than the order (${order.amount} paise).`);
  const { data, error } = await db().rpc("razorpay_capture_plan_payment", {
    p_order_id: orderId,
    p_payment_id: paid.id,
    p_amount_paise: Number(order.amount),
    p_method: String(paid.method ?? ""),
  });
  if (error) throw new Error(error.message);
  const already = (data as { already_done: boolean }[] | null)?.[0]?.already_done;
  return { activated: !already, paymentId: paid.id, message: already ? "Already active — nothing to change." : "Payment found on Razorpay. The plan is now active." };
}
