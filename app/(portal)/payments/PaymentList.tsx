"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Eye, RefreshCw, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { formatDate, formatInr, timeAgo } from "@/lib/utils";
import { Badge, Field, Spinner, dangerBtn, inputCls, primaryBtn, secondaryBtn, type Tone } from "@/components/ui";
import { Modal } from "@/components/modal";

export interface PaymentItem {
  id: string;
  agentId: string;
  agent: { name: string; email: string; company: string | null };
  plan_id: string;
  billing_cycle?: string;
  amount_inr: number;
  payment_transaction_id: string;
  proof_type: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  decided_at: string | null;
  refunded_at: string | null;
  reviewer: string | null;
  decider: string | null;
  // Online (Razorpay) payments — present after migration 0011.
  provider?: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  failure_reason?: string | null;
  refund_status?: string | null;
}

interface LivePayment {
  id: string;
  orderId: string | null;
  status: string;
  method: string;
  amountInr: number;
  feeInr: number | null;
  taxInr: number | null;
  refundedInr: number;
  refundStatus: string | null;
  email: string | null;
  contact: string | null;
  instrument: string | null;
  bankReference: string | null;
  error: string | null;
  createdAt: string;
  refunds: { id: string; amountInr: number; status: string; createdAt: string }[];
}

type Details = { kind: "proof"; proof: string; proof_type: string } | { kind: "online"; payment: LivePayment | null; orderId: string | null };

type Action = "check" | "approve" | "reject" | "refund";

const STATUS_TONE: Record<string, Tone> = { created: "neutral", pending: "amber", approved: "green", rejected: "red", refunded: "neutral" };
const STATUS_LABEL: Record<string, string> = { created: "Not paid yet" };
const LIVE_TONE: Record<string, Tone> = { captured: "green", authorized: "amber", refunded: "neutral", failed: "red", created: "neutral" };

const isOnline = (p: PaymentItem) => p.provider === "razorpay";

export default function PaymentList({ items, canCheck, canDecide, canRefund }: { items: PaymentItem[]; canCheck: boolean; canDecide: boolean; canRefund: boolean }) {
  const router = useRouter();
  const [detailsFor, setDetailsFor] = useState<PaymentItem | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [detailsError, setDetailsError] = useState("");
  const [acting, setActing] = useState<{ item: PaymentItem; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [confirmUnchecked, setConfirmUnchecked] = useState(false);
  const [revertPlan, setRevertPlan] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const openDetails = async (item: PaymentItem) => {
    setDetailsFor(item);
    setDetails(null);
    setDetailsError("");
    const r = await api<Details>(`/api/payments/${item.id}`);
    if (r.success && r.data) setDetails(r.data);
    else setDetailsError(r.error?.message ?? "Could not load the payment details.");
  };

  const sync = async (item: PaymentItem) => {
    setSyncing(item.id);
    const r = await api<{ activated: boolean }>(`/api/payments/${item.id}`, { json: { action: "sync" } });
    setSyncing(null);
    if (!r.success) return toast.error(r.error?.message ?? "Could not reach Razorpay.");
    if (r.data?.activated) toast.success(r.message ?? "Plan activated.");
    else toast.info(r.message ?? "Nothing to change.");
    router.refresh();
  };

  const start = (item: PaymentItem, action: Action) => {
    setActing({ item, action });
    setNote("");
    setConfirmUnchecked(false);
    setRevertPlan(true);
  };

  const submit = async () => {
    if (!acting) return;
    setBusy(true);
    const r = await api(`/api/payments/${acting.item.id}`, { json: { action: acting.action, note, confirmUnchecked, revertPlan } });
    setBusy(false);
    if (!r.success) return toast.error(r.error?.message ?? "Something went wrong.");
    toast.success(r.message ?? "Done.");
    setActing(null);
    router.refresh();
  };

  const titles = (item: PaymentItem): Record<Action, string> => ({
    check: "Mark as checked",
    approve: "Approve payment",
    reject: "Reject payment",
    refund: isOnline(item) ? "Refund through Razorpay" : "Record a refund",
  });

  return (
    <>
      <ul className="grid gap-3">
        {items.map((p) => (
          <li key={p.id} className="anim-rise rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/agents/${p.agentId}`} className="truncate font-semibold hover:text-brand-600 dark:hover:text-brand-300">
                    {p.agent.company || p.agent.name}
                  </Link>
                  <Badge tone={STATUS_TONE[p.status] ?? "neutral"} className="capitalize">{STATUS_LABEL[p.status] ?? p.status}</Badge>
                  {isOnline(p) ? (
                    <Badge tone="blue"><CreditCard className="h-3 w-3" /> Online{p.payment_method ? ` · ${p.payment_method}` : ""}</Badge>
                  ) : p.status === "pending" ? (
                    p.reviewed_at ? <Badge tone="blue"><ShieldCheck className="h-3 w-3" /> Checked</Badge> : <Badge tone="amber">Not checked</Badge>
                  ) : null}
                  {p.refund_status ? <Badge tone={p.refund_status === "failed" ? "red" : p.refund_status === "processed" ? "green" : "amber"}>Refund {p.refund_status}</Badge> : null}
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{p.agent.email}</p>
                <p className="mt-2 text-sm">
                  <span className="font-semibold capitalize">{p.plan_id}</span>
                  {p.billing_cycle ? <span className="capitalize"> · {p.billing_cycle}</span> : null} · <span className="font-semibold">{formatInr(p.amount_inr)}</span>
                  <span className="text-[var(--muted-foreground)]"> · {isOnline(p) ? (p.razorpay_payment_id ? "Payment " : "Order ") : "Txn "}</span>
                  <span className="font-mono text-xs">{isOnline(p) ? p.razorpay_payment_id ?? p.razorpay_order_id : p.payment_transaction_id}</span>
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {p.status === "created" ? "Checkout opened" : isOnline(p) ? "Paid" : "Submitted"} {timeAgo(p.paid_at ?? p.created_at)}
                  {p.reviewer ? ` · checked by ${p.reviewer} ${timeAgo(p.reviewed_at)}` : ""}
                  {p.decider && p.decided_at ? ` · decided by ${p.decider} on ${formatDate(p.decided_at)}` : ""}
                  {p.refunded_at ? ` · refunded ${formatDate(p.refunded_at)}` : ""}
                </p>
                {p.status === "created" && p.failure_reason ? <p className="mt-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">Last attempt failed: {p.failure_reason}</p> : null}
                {p.review_note ? <p className="mt-1 rounded-lg bg-[var(--muted)] px-2.5 py-1.5 text-xs">Note: {p.review_note}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {!isOnline(p) || p.razorpay_payment_id ? (
                  <button type="button" onClick={() => openDetails(p)} className={secondaryBtn}>
                    <Eye className="h-4 w-4" /> {isOnline(p) ? "Details" : "Proof"}
                  </button>
                ) : null}
                {isOnline(p) && p.status === "created" && canCheck ? (
                  <button type="button" disabled={syncing === p.id} onClick={() => sync(p)} className={secondaryBtn} title="Ask Razorpay whether this order was paid, and activate the plan if it was">
                    {syncing === p.id ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Check with Razorpay
                  </button>
                ) : null}
                {p.status === "pending" && canCheck && !p.reviewed_at ? (
                  <button type="button" onClick={() => start(p, "check")} className={secondaryBtn}>
                    <ShieldCheck className="h-4 w-4" /> Mark checked
                  </button>
                ) : null}
                {p.status === "pending" && canDecide ? (
                  <>
                    <button type="button" onClick={() => start(p, "reject")} className={secondaryBtn}>
                      <XCircle className="h-4 w-4 text-rose-500" /> Reject
                    </button>
                    <button type="button" onClick={() => start(p, "approve")} className={primaryBtn}>
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </button>
                  </>
                ) : null}
                {p.status === "approved" && canRefund ? (
                  <button type="button" onClick={() => start(p, "refund")} className={secondaryBtn}>
                    <RotateCcw className="h-4 w-4" /> Refund
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={!!detailsFor}
        onOpenChange={(v) => !v && setDetailsFor(null)}
        title={detailsFor && isOnline(detailsFor) ? "Online payment" : "Payment proof"}
        description={detailsFor ? `${detailsFor.agent.company || detailsFor.agent.name} · ${isOnline(detailsFor) ? detailsFor.razorpay_payment_id ?? detailsFor.razorpay_order_id : `Txn ${detailsFor.payment_transaction_id}`}` : undefined}
        wide={!detailsFor || !isOnline(detailsFor)}
      >
        {detailsError ? (
          <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">{detailsError}</p>
        ) : !details ? (
          <div className="skeleton h-64 w-full rounded-xl" />
        ) : details.kind === "online" ? (
          details.payment ? <LiveDetails p={details.payment} /> : <p className="text-sm text-[var(--muted-foreground)]">No payment has been made on order {details.orderId} yet.</p>
        ) : (
          <>
            {details.proof_type === "application/pdf" ? (
              <iframe src={details.proof} title="Payment proof PDF" className="h-[70vh] w-full rounded-xl border border-[var(--border)]" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={details.proof} alt="Payment proof" className="mx-auto max-h-[70vh] rounded-xl border border-[var(--border)]" />
            )}
            <p className="mt-3 text-xs text-[var(--muted-foreground)]">Match the amount, date and transaction ID against your UPI / bank statement before approving.</p>
          </>
        )}
      </Modal>

      <Modal
        open={!!acting}
        onOpenChange={(v) => !v && setActing(null)}
        title={acting ? titles(acting.item)[acting.action] : ""}
        description={acting ? `${acting.item.agent.company || acting.item.agent.name} · ${acting.item.plan_id} · ${formatInr(acting.item.amount_inr)}` : undefined}
      >
        {acting ? (
          <div className="space-y-4">
            {acting.action === "approve" ? (
              <p className="text-sm">This activates the <strong className="capitalize">{acting.item.plan_id}</strong> plan{acting.item.billing_cycle ? ` (${acting.item.billing_cycle})` : ""} on the agent&apos;s account right away. If they&apos;re renewing, the new term continues from their current end date.</p>
            ) : null}
            {acting.action === "approve" && !acting.item.reviewed_at ? (
              <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <input type="checkbox" checked={confirmUnchecked} onChange={(e) => setConfirmUnchecked(e.target.checked)} className="mt-0.5" />
                Nobody has checked this proof yet. I&apos;ve matched it against the UPI statement myself.
              </label>
            ) : null}
            {acting.action === "refund" && isOnline(acting.item) ? (
              <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                This sends <strong>{formatInr(acting.item.amount_inr)}</strong> back to the agent&apos;s original payment method through Razorpay. It can&apos;t be undone. Razorpay keeps its fee on refunded payments.
              </p>
            ) : null}
            {acting.action === "refund" ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={revertPlan} onChange={(e) => setRevertPlan(e.target.checked)} className="mt-0.5" />
                Also move the agent back to the free Silver plan
              </label>
            ) : null}
            <Field
              label={acting.action === "reject" ? "Reason (required)" : acting.action === "refund" ? (isOnline(acting.item) ? "Reason (required)" : "Refund reference or reason (required)") : "Note (optional)"}
              htmlFor="pay-note"
              hint={acting.action === "check" ? "e.g. “Matched ₹1,999 on HDFC statement, 2 Oct.”" : undefined}
            >
              <textarea id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className={`${inputCls} h-auto py-2`} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setActing(null)} className={secondaryBtn}>Cancel</button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || ((acting.action === "reject" || acting.action === "refund") && !note.trim()) || (acting.action === "approve" && !acting.item.reviewed_at && !confirmUnchecked)}
                className={acting.action === "reject" || acting.action === "refund" ? dangerBtn : primaryBtn}
              >
                {busy ? <Spinner /> : null} {titles(acting.item)[acting.action]}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function LiveDetails({ p }: { p: LivePayment }) {
  const rows: [string, React.ReactNode][] = [
    ["Status on Razorpay", <Badge key="s" tone={LIVE_TONE[p.status] ?? "neutral"} className="capitalize">{p.status}</Badge>],
    ["Amount", formatInr(p.amountInr)],
    ["Method", <span key="m" className="capitalize">{p.method || "—"}</span>],
    ["Paid with", p.instrument ?? "—"],
    ["Bank reference (RRN / UTR)", p.bankReference ? <span key="r" className="font-mono text-xs">{p.bankReference}</span> : "—"],
    ["Razorpay fee + GST", p.feeInr != null ? `${formatInr(p.feeInr)}${p.taxInr ? ` (incl. ${formatInr(p.taxInr)} GST)` : ""}` : "—"],
    ["Refunded", p.refundedInr ? formatInr(p.refundedInr) : "—"],
    ["Payer email / mobile", [p.email, p.contact].filter(Boolean).join(" · ") || "—"],
    ["Order", p.orderId ? <span key="o" className="font-mono text-xs">{p.orderId}</span> : "—"],
    ["Created", new Date(p.createdAt).toLocaleString("en-IN")],
  ];
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-[var(--muted-foreground)]">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      {p.error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">{p.error}</p> : null}
      {p.refunds.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Refunds</p>
          <ul className="space-y-1 text-sm">
            {p.refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{r.id}</span> · {formatInr(r.amountInr)} · <Badge tone={r.status === "processed" ? "green" : r.status === "failed" ? "red" : "amber"}>{r.status}</Badge> · {formatDate(r.createdAt)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-[var(--muted-foreground)]">Live from Razorpay. Open the Razorpay dashboard for settlements and disputes.</p>
    </div>
  );
}
