import Link from "next/link";
import { CreditCard } from "lucide-react";
import { db, hasColumn } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { agentNames } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/ui";
import PaymentList, { type PaymentItem } from "./PaymentList";

export const metadata = { title: "Plan payments" };

const TABS = [
  { key: "to-check", label: "To check" },
  { key: "checked", label: "Checked — awaiting approval" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "refunded", label: "Refunded" },
] as const;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requirePage("payments.view");
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === requested)?.key ?? "to-check";

  const cycles = await hasColumn("plan_payments", "billing_cycle");
  const cols = `id,agent_id,plan_id,amount_inr,payment_transaction_id,proof_type,status,created_at,updated_at,reviewed_at,reviewed_by,review_note,decided_at,decided_by,refunded_at${cycles ? ",billing_cycle" : ""}`;
  let q = db().from("plan_payments").select(cols);
  if (tab === "to-check") q = q.eq("status", "pending").is("reviewed_at", null);
  else if (tab === "checked") q = q.eq("status", "pending").not("reviewed_at", "is", null);
  else q = q.eq("status", tab);
  const { data, error } = await q.order("created_at", { ascending: tab === "to-check" || tab === "checked" }).limit(200);

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
            ? "Sub-admins check UPI proofs; you approve, reject or refund. Approving activates the plan immediately."
            : "Open each proof, match it against the UPI statement, and mark it checked. A master admin gives the final approval."
        }
      />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/payments?tab=${t.key}`}
            className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition", tab === t.key ? "bg-ink text-white dark:bg-brand-neon dark:text-ink" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {error ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">Could not load payments: {error.message}. Has migration 0006 been run?</p>
      ) : items.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments here" text="New UPI payment proofs from agents appear in “To check”." />
      ) : (
        <PaymentList items={items} canCheck={can(admin, "payments.check")} canDecide={can(admin, "payments.decide")} canRefund={can(admin, "payments.refund")} />
      )}
    </>
  );
}
