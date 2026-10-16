import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Admin-side Razorpay: "Check with Razorpay" (syncOrder), live payment details and refunds.
 * The Razorpay SDK and the database are mocked; no network calls are made.
 */

const rzp = {
  orders: { fetch: vi.fn(), fetchPayments: vi.fn() },
  payments: { fetch: vi.fn(), capture: vi.fn(), refund: vi.fn(), fetchMultipleRefund: vi.fn() },
};
vi.mock("razorpay", () => ({ default: vi.fn(() => rzp) }));

const rpc = vi.fn();
vi.mock("@/lib/db", () => ({ db: () => ({ rpc }) }));

process.env.RAZORPAY_KEY_ID = "rzp_test_unit";
process.env.RAZORPAY_KEY_SECRET = "unit_key_secret";

const { syncOrder, lookupPayment, refundPayment, razorpayErrorText } = await import("@/lib/razorpay");

beforeEach(() => {
  for (const group of Object.values(rzp)) for (const fn of Object.values(group)) fn.mockReset();
  rpc.mockReset();
  rzp.orders.fetch.mockResolvedValue({ id: "order_1", amount: 19900 });
  rpc.mockResolvedValue({ data: [{ already_done: false }], error: null });
});

describe("syncOrder (Check with Razorpay)", () => {
  it("activates the plan when the order has a captured payment", async () => {
    rzp.orders.fetchPayments.mockResolvedValue({ items: [{ id: "pay_1", status: "captured", amount: 19900, method: "upi" }] });
    const r = await syncOrder("order_1");
    expect(r).toMatchObject({ activated: true, paymentId: "pay_1" });
    expect(rpc).toHaveBeenCalledWith("razorpay_capture_plan_payment", { p_order_id: "order_1", p_payment_id: "pay_1", p_amount_paise: 19900, p_method: "upi" });
  });

  it("accepts the gateway fee on top of the order (the ₹199 → ₹203.70 case)", async () => {
    rzp.orders.fetchPayments.mockResolvedValue({ items: [{ id: "pay_1", status: "captured", amount: 20370, method: "upi" }] });
    await syncOrder("order_1");
    expect(rpc).toHaveBeenCalledWith("razorpay_capture_plan_payment", expect.objectContaining({ p_amount_paise: 19900 }));
  });

  it("refuses a payment smaller than the order", async () => {
    rzp.orders.fetchPayments.mockResolvedValue({ items: [{ id: "pay_1", status: "captured", amount: 500, method: "upi" }] });
    await expect(syncOrder("order_1")).rejects.toThrow(/less than the order/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("captures an authorized payment first", async () => {
    rzp.orders.fetchPayments.mockResolvedValue({ items: [{ id: "pay_1", status: "authorized", amount: 20370, method: "card" }] });
    rzp.payments.capture.mockResolvedValue({ id: "pay_1", status: "captured", amount: 20370, method: "card" });
    await syncOrder("order_1");
    expect(rzp.payments.capture).toHaveBeenCalledWith("pay_1", 20370, "INR");
  });

  it("explains when nothing was paid, without touching the database", async () => {
    rzp.orders.fetchPayments.mockResolvedValue({ items: [] });
    expect(await syncOrder("order_1")).toMatchObject({ activated: false, message: "No payment was attempted on this order." });
    rzp.orders.fetchPayments.mockResolvedValue({ items: [{ id: "p1", status: "failed" }, { id: "p2", status: "failed" }] });
    expect((await syncOrder("order_1")).message).toMatch(/2 failed attempts/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports 'already active' when the plan was activated earlier", async () => {
    rzp.orders.fetchPayments.mockResolvedValue({ items: [{ id: "pay_1", status: "captured", amount: 19900, method: "upi" }] });
    rpc.mockResolvedValue({ data: [{ already_done: true }], error: null });
    expect(await syncOrder("order_1")).toMatchObject({ activated: false, message: "Already active — nothing to change." });
  });
});

describe("lookupPayment", () => {
  it("turns paise into rupees and picks the identifying detail", async () => {
    rzp.payments.fetch.mockResolvedValue({
      id: "pay_1", order_id: "order_1", status: "captured", method: "upi", amount: 20370, fee: 470, tax: 72, amount_refunded: 0,
      refund_status: "null", captured: true, vpa: "agent@okhdfc", email: "a@b.in", contact: "+919999999999",
      acquirer_data: { rrn: "123456789012" }, created_at: 1760400000,
    });
    rzp.payments.fetchMultipleRefund.mockResolvedValue({ items: [] });
    const p = await lookupPayment("pay_1");
    expect(p).toMatchObject({ amountInr: 203.7, feeInr: 4.7, taxInr: 0.72, refundStatus: null, instrument: "agent@okhdfc", bankReference: "123456789012" });
  });

  it("shows a card as network + last four digits", async () => {
    rzp.payments.fetch.mockResolvedValue({ id: "pay_2", status: "captured", method: "card", amount: 19900, card: { network: "Visa", last4: "1111" }, created_at: 1760400000 });
    rzp.payments.fetchMultipleRefund.mockRejectedValue(new Error("no refunds"));
    const p = await lookupPayment("pay_2");
    expect(p.instrument).toBe("Visa •••• 1111");
    expect(p.refunds).toEqual([]);
  });
});

describe("refundPayment", () => {
  it("refunds the plan price in paise", async () => {
    rzp.payments.refund.mockResolvedValue({ id: "rfnd_1", status: "processed" });
    expect(await refundPayment("pay_1", 199, { reason: "test" })).toEqual({ id: "rfnd_1", status: "processed" });
    expect(rzp.payments.refund).toHaveBeenCalledWith("pay_1", { amount: 19900, speed: "normal", notes: { reason: "test" } });
  });

  it("reads Razorpay error descriptions", () => {
    expect(razorpayErrorText({ error: { description: "The payment has been fully refunded already" } })).toBe("The payment has been fully refunded already");
  });
});
