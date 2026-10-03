"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
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
}

type Action = "check" | "approve" | "reject" | "refund";

const STATUS_TONE: Record<string, Tone> = { pending: "amber", approved: "green", rejected: "red", refunded: "neutral" };

export default function PaymentList({ items, canCheck, canDecide, canRefund }: { items: PaymentItem[]; canCheck: boolean; canDecide: boolean; canRefund: boolean }) {
  const router = useRouter();
  const [proofFor, setProofFor] = useState<PaymentItem | null>(null);
  const [proof, setProof] = useState<{ proof: string; proof_type: string } | null>(null);
  const [acting, setActing] = useState<{ item: PaymentItem; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [confirmUnchecked, setConfirmUnchecked] = useState(false);
  const [revertPlan, setRevertPlan] = useState(true);
  const [busy, setBusy] = useState(false);

  const openProof = async (item: PaymentItem) => {
    setProofFor(item);
    setProof(null);
    const r = await api<{ proof: string; proof_type: string }>(`/api/payments/${item.id}`);
    if (r.success && r.data) setProof(r.data);
    else toast.error(r.error?.message ?? "Could not load the proof.");
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

  const TITLES: Record<Action, string> = { check: "Mark as checked", approve: "Approve payment", reject: "Reject payment", refund: "Record a refund" };

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
                  <Badge tone={STATUS_TONE[p.status] ?? "neutral"} className="capitalize">{p.status}</Badge>
                  {p.status === "pending" ? p.reviewed_at ? <Badge tone="blue"><ShieldCheck className="h-3 w-3" /> Checked</Badge> : <Badge tone="amber">Not checked</Badge> : null}
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{p.agent.email}</p>
                <p className="mt-2 text-sm">
                  <span className="font-semibold capitalize">{p.plan_id}</span>
                  {p.billing_cycle ? <span className="capitalize"> · {p.billing_cycle}</span> : null} · <span className="font-semibold">{formatInr(p.amount_inr)}</span>
                  <span className="text-[var(--muted-foreground)]"> · Txn </span>
                  <span className="font-mono text-xs">{p.payment_transaction_id}</span>
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Submitted {timeAgo(p.created_at)}
                  {p.reviewer ? ` · checked by ${p.reviewer} ${timeAgo(p.reviewed_at)}` : ""}
                  {p.decider && p.decided_at ? ` · decided by ${p.decider} on ${formatDate(p.decided_at)}` : ""}
                  {p.refunded_at ? ` · refunded ${formatDate(p.refunded_at)}` : ""}
                </p>
                {p.review_note ? <p className="mt-1 rounded-lg bg-[var(--muted)] px-2.5 py-1.5 text-xs">Note: {p.review_note}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <button type="button" onClick={() => openProof(p)} className={secondaryBtn}>
                  <Eye className="h-4 w-4" /> Proof
                </button>
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

      <Modal open={!!proofFor} onOpenChange={(v) => !v && setProofFor(null)} title="Payment proof" description={proofFor ? `${proofFor.agent.company || proofFor.agent.name} · Txn ${proofFor.payment_transaction_id}` : undefined} wide>
        {!proof ? (
          <div className="skeleton h-80 w-full rounded-xl" />
        ) : proof.proof_type === "application/pdf" ? (
          <iframe src={proof.proof} title="Payment proof PDF" className="h-[70vh] w-full rounded-xl border border-[var(--border)]" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proof.proof} alt="Payment proof" className="mx-auto max-h-[70vh] rounded-xl border border-[var(--border)]" />
        )}
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">Match the amount, date and transaction ID against your UPI / bank statement before approving.</p>
      </Modal>

      <Modal open={!!acting} onOpenChange={(v) => !v && setActing(null)} title={acting ? TITLES[acting.action] : ""} description={acting ? `${acting.item.agent.company || acting.item.agent.name} · ${acting.item.plan_id} · ${formatInr(acting.item.amount_inr)}` : undefined}>
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
            {acting.action === "refund" ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={revertPlan} onChange={(e) => setRevertPlan(e.target.checked)} className="mt-0.5" />
                Also move the agent back to the free Silver plan
              </label>
            ) : null}
            <Field
              label={acting.action === "reject" ? "Reason (required)" : acting.action === "refund" ? "Refund reference or reason (required)" : "Note (optional)"}
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
                {busy ? <Spinner /> : null} {TITLES[acting.action]}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
