/**
 * Plan rules mirrored from the Voyenta app (checkin-app/lib/agent/plans.ts). Keep the two in sync:
 * the app enforces them; the admin portal uses them to show plan status and default prices.
 */

export type PlanId = "silver" | "gold" | "platinum";
export type PaidPlanId = "gold" | "platinum";
export type BillingCycle = "monthly" | "yearly";
export type Prices = Record<PaidPlanId, Record<BillingCycle, number>>;

/** Default prices (INR, GST inclusive) — used unless a master sets others in Settings. */
export const DEFAULT_PRICES: Prices = {
  gold: { monthly: 199, yearly: 1999 },
  platinum: { monthly: 699, yearly: 6999 },
};

/** Fixed in the app's code and in approve_plan_payment() (migration 0005). */
export const GRACE_DAYS: Record<BillingCycle, number> = { monthly: 2, yearly: 5 };
export const FREE_MONTHLY_DOCUMENTS = 4;

export const SERVICE_LABELS: Record<string, string> = {
  hotel_voucher: "Hotel vouchers",
  air_ticket: "Air tickets",
  pickup_voucher: "Pickup vouchers",
  welcome_placard: "Welcome placards",
  invoice: "Tax invoices",
  proforma: "Proforma invoices",
  receipt: "Payment receipts",
};

export function planName(p: string | null | undefined): string {
  return p === "gold" ? "Gold" : p === "platinum" ? "Platinum" : "Silver";
}

export interface SubscriptionState {
  plan: PlanId;
  paidPlan: PaidPlanId | null;
  cycle: BillingCycle | null;
  status: "free" | "active" | "grace" | "lapsed";
  expiresAt: string | null;
  graceEndsAt: string | null;
  daysLeft: number | null;
}

const DAY_MS = 86_400_000;

export function subscriptionState(
  a: { subscription_plan?: string | null; subscription_expires_at?: string | null; subscription_cycle?: string | null },
  now = Date.now()
): SubscriptionState {
  const plan: PlanId = a.subscription_plan === "gold" || a.subscription_plan === "platinum" ? a.subscription_plan : "silver";
  if (plan === "silver") return { plan, paidPlan: null, cycle: null, status: "free", expiresAt: null, graceEndsAt: null, daysLeft: null };
  const cycle: BillingCycle = a.subscription_cycle === "monthly" ? "monthly" : "yearly";
  const expires = a.subscription_expires_at ? new Date(a.subscription_expires_at).getTime() : NaN;
  if (Number.isNaN(expires)) return { plan, paidPlan: plan, cycle, status: "active", expiresAt: null, graceEndsAt: null, daysLeft: null };
  const graceEnds = expires + GRACE_DAYS[cycle] * DAY_MS;
  const base = { paidPlan: plan, cycle, expiresAt: new Date(expires).toISOString(), graceEndsAt: new Date(graceEnds).toISOString() };
  if (now < expires) return { ...base, plan, status: "active", daysLeft: Math.ceil((expires - now) / DAY_MS) };
  if (now < graceEnds) return { ...base, plan, status: "grace", daysLeft: Math.max(1, Math.ceil((graceEnds - now) / DAY_MS)) };
  return { ...base, plan: "silver", status: "lapsed", daysLeft: null };
}
