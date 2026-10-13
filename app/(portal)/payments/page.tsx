import { CreditCard } from "lucide-react";
import { db, hasColumn } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { agentNames } from "@/lib/agents";
import { EmptyState, PageHeader } from "@/components/ui";
import { NavBar } from "@/components/ui/tubelight-navbar";
import PaymentList, { type PaymentItem } from "./PaymentList";

export const metadata = { title: "Plan payments" };

const TABS = [
  { key: "to-check", label: "To check" },
  { key: "checked", label: "Checked — awaiting approval" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "refunded", label: "Refunded" },
  { key: "incomplete", label: "Online — not completed" },
] as const;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requirePage("payments.view");
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === requested)?.key ?? "to-check";

  const [cycles, online] = await Promise.all([hasColumn("plan_payments", "billing_cycle"), hasColumn("plan_payments", "razorpay_order_id")]);
  const cols =
    "id,agent_id,plan_id,amount_inr,payment_transaction_id,proof_type,status,created_at,updated_at,reviewed_at,reviewed_by,review_note,decided_at,decided_by,refunded_at" +
    (cycles ? ",billing_cycle" : "") +
    (online ? ",provider,razorpay_order_id,razorpay_payment_id,payment_method,paid_at,failure_reason,refund_status" : "");
  let q = db().from("plan_payments").select(cols);
  if (tab === "to-check") q = q.eq("status", "pending").is("reviewed_at", null);
  else if (tab === "checked") q = q.eq("status", "pending").not("reviewed_at", "is", null);
  else if (tab === "incomplete") q = q.eq("status", "created");
  else q = q.eq("status", tab);
  const { data, error } = tab === "incomplete" && !online ? { data: [], error: null } : await q.order("created_at", { ascending: tab === "to-check" || tab === "checked" }).limit(200);

  const rows = (data ?? []) as unknown as (Omit<PaymentItem, "agent" | "reviewer" | "decider"> & { agent_id: string; reviewed_by: string | null; decided_by: string | null })[];
  const names = await agentNames(rows.map((r) => r.agent_id));
  const adminIds = [...new Set(rows.flatMap((r) => [r.reviewed_by, r.decided_by]).filter(Boolean))] as string[];
  const { data: admins } = adminIds.length ? await db().from("admins").select("id,name").in("id", adminIds) : { data: [] };
  const adminName = new Map(((admins ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));

  const items: PaymentItem[] = rows.map((r) => ({
    ...r,
    agent: names.get(r.agent_id) ?? { name: "Deleted agent", email: "", company: null },
    agentId: r.agent_id,
    reviewer: r.reviewed_by ? adminName.get(r.reviewed_by) ?? "Former admin" : null,
    decider: r.decided_by ? adminName.get(r.decided_by) ?? "Former admin" : null,
  }));

  return (
    <>
      <PageHeader
        title="Plan payments"
        description={
          can(admin, "payments.decide")
            ? "Online payments activate plans automatically. Sub-admins check UPI proofs; you approve, reject or refund. Online refunds go back through Razorpay."
            : "Online payments activate plans automatically. For UPI proofs, match each one against the statement and mark it checked. A master admin gives the final approval."
        }
      />
      <NavBar
        className="mb-5"
        layoutId="payments-tabs"
        items={TABS.map((t) => ({ name: t.label, url: `/payments?tab=${t.key}` }))}
        active={TABS.find((t) => t.key === tab)?.label}
      />
      {error ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">Could not load payments: {error.message}. Has migration 0006 been run?</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments here"
          text={tab === "incomplete" ? "Online checkouts that were opened but not paid show up here. If an agent says they paid, use “Check with Razorpay”." : "New UPI payment proofs from agents appear in “To check”."}
        />
      ) : (
        <PaymentList items={items} canCheck={can(admin, "payments.check")} canDecide={can(admin, "payments.decide")} canRefund={can(admin, "payments.refund")} />
      )}
    </>
  );
}
