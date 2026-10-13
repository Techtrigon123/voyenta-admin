"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Copy, Download, KeyRound, LockOpen, Mail, ShieldBan, ShieldCheck, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/utils";
import { Card, CardTitle, Field, Spinner, dangerBtn, inputCls, primaryBtn, secondaryBtn } from "@/components/ui";
import { Modal } from "@/components/modal";

interface AgentInfo {
  id: string;
  email: string;
  name: string;
  status: string;
  isVerified: boolean;
  reviewStatus: string | null;
  plan: string;
  cycle: string | null;
  expiresAt: string | null;
  features: { air_ticket: boolean; pickup_voucher: boolean; welcome_placard: boolean };
}

interface Perms {
  review: boolean;
  resetLink: boolean;
  unlock: boolean;
  suspend: boolean;
  features: boolean;
  plan: boolean;
  email: boolean;
  del: boolean;
  exportData: boolean;
}

type Dialog = null | "suspend" | "plan" | "email" | "delete" | "reset";

const FEATURES = [
  { key: "air_ticket", label: "Air tickets" },
  { key: "pickup_voucher", label: "Pickup vouchers" },
  { key: "welcome_placard", label: "Welcome placards" },
] as const;

/** One call to the agent API, with toasts and a refresh. */
function useAgentAction(agentId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async <T,>(json: Record<string, unknown>): Promise<T | null> => {
    setBusy(true);
    const r = await api<T>(`/api/agents/${agentId}`, { json });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error?.message ?? "Something went wrong.");
      return null;
    }
    toast.success(r.message ?? "Saved.");
    router.refresh();
    return (r.data ?? (true as unknown as T)) as T;
  };
  return { run, busy };
}

export default function AgentActions({ agent, perms }: { agent: AgentInfo; perms: Perms }) {
  const router = useRouter();
  const { run, busy } = useAgentAction(agent.id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [resetLink, setResetLink] = useState("");
  const [reason, setReason] = useState("");
  const [planForm, setPlanForm] = useState({ plan: agent.plan, cycle: agent.cycle ?? "yearly", expiresAt: agent.expiresAt?.slice(0, 10) ?? "" });
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [features, setFeatures] = useState(agent.features);

  const open = (d: Dialog) => {
    setDialog(d);
    setReason("");
    setEmail("");
    setConfirmEmail("");
  };

  const suspended = agent.status === "SUSPENDED";
  const showAccountHelp = perms.resetLink || perms.unlock;
  const showDanger = perms.suspend || perms.email || perms.del || perms.exportData;

  return (
    <>
      <Card>
        <CardTitle>Profile review</CardTitle>
        <p className="mb-3 text-sm text-[var(--muted-foreground)]">
          {agent.reviewStatus === null
            ? "Run migration 0007 to turn on profile reviews."
            : agent.isVerified
              ? "Approved — the agent is Verified and can download PDFs."
              : "Not approved yet — the agent can create documents but not download them."}
        </p>
        {perms.review && agent.reviewStatus !== null ? (
          <Link href={`/verifications/${agent.id}`} className={secondaryBtn}>
            <BadgeCheck className="h-4 w-4" /> Open profile review
          </Link>
        ) : null}
      </Card>

      {showAccountHelp ? (
        <Card>
          <CardTitle>Account help</CardTitle>
          <div className="flex flex-col gap-2">
            {perms.resetLink ? (
              <button
                type="button"
                disabled={busy || suspended}
                onClick={async () => {
                  const data = await run<{ link: string }>({ action: "reset_link" });
                  if (data?.link) {
                    setResetLink(data.link);
                    setDialog("reset");
                  }
                }}
                className={secondaryBtn}
              >
                <KeyRound className="h-4 w-4" /> Create password-reset link
              </button>
            ) : null}
            {perms.unlock ? (
              <button type="button" disabled={busy} onClick={() => run({ action: "unlock" })} className={secondaryBtn}>
                <LockOpen className="h-4 w-4" /> Unlock sign-in (clear lockouts)
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">Admins never set an agent&apos;s password — the agent chooses it from the link.</p>
        </Card>
      ) : null}

      <Card>
        <CardTitle hint={perms.features ? undefined : "Master admins can change these"}>Services</CardTitle>
        <ul className="space-y-2">
          {FEATURES.map((f) => (
            <li key={f.key} className="flex items-center justify-between text-sm">
              {f.label}
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={features[f.key]}
                  disabled={!perms.features}
                  onChange={(e) => setFeatures({ ...features, [f.key]: e.target.checked })}
                />
                <span className="h-6 w-11 rounded-full bg-[var(--border)] transition peer-checked:bg-brand-500 peer-disabled:opacity-60" />
                <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">Switching a service off hides it for this agent even if their plan includes it.</p>
        {perms.features && JSON.stringify(features) !== JSON.stringify(agent.features) ? (
          <button type="button" disabled={busy} onClick={() => run({ action: "features", ...features })} className={`${primaryBtn} mt-3 w-full`}>
            {busy ? <Spinner /> : null} Save services
          </button>
        ) : null}
      </Card>

      {perms.plan ? (
        <Card>
          <CardTitle>Change plan</CardTitle>
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">Give a complimentary plan, extend one, or move the agent to Silver. Paid plans normally activate from Plan payments.</p>
          <button type="button" onClick={() => open("plan")} className={secondaryBtn}>
            <Wand2 className="h-4 w-4" /> Give or change plan
          </button>
        </Card>
      ) : null}

      {showDanger ? (
        <Card className="border-rose-200 dark:border-rose-900">
          <CardTitle>Owner actions</CardTitle>
          <div className="flex flex-col gap-2">
            {perms.exportData ? (
              <a href={`/api/agents/${agent.id}/export`} className={secondaryBtn}>
                <Download className="h-4 w-4" /> Export agent data (JSON)
              </a>
            ) : null}
            {perms.email ? (
              <button type="button" onClick={() => open("email")} className={secondaryBtn}>
                <Mail className="h-4 w-4" /> Change email
              </button>
            ) : null}
            {perms.suspend ? (
              suspended ? (
                <button type="button" disabled={busy} onClick={() => run({ action: "suspend", suspended: false })} className={secondaryBtn}>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Reactivate account
                </button>
              ) : (
                <button type="button" onClick={() => open("suspend")} className={secondaryBtn}>
                  <ShieldBan className="h-4 w-4 text-rose-500" /> Suspend account
                </button>
              )
            ) : null}
            {perms.del ? (
              <button type="button" onClick={() => open("delete")} className={dangerBtn}>
                <Trash2 className="h-4 w-4" /> Delete agent
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Reset link */}
      <Modal open={dialog === "reset"} onOpenChange={(v) => !v && setDialog(null)} title="Password-reset link" description="Send this to the agent on their registered email or WhatsApp. It works once, for 1 hour.">
        <div className="flex gap-2">
          <input readOnly value={resetLink} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.target.select()} />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(resetLink).then(() => toast.success("Link copied."));
            }}
            className={secondaryBtn}
            aria-label="Copy link"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">Only send it to the contact details on the account — never to someone asking on the agent&apos;s behalf.</p>
      </Modal>

      {/* Suspend */}
      <Modal open={dialog === "suspend"} onOpenChange={(v) => !v && setDialog(null)} title={`Suspend ${agent.name}?`} description="The agent is signed out of Vouchlio and can't sign in until you reactivate the account. Their data is kept.">
        <Field label="Reason (recorded in the audit log)" htmlFor="sus-reason">
          <input id="sus-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} maxLength={300} />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setDialog(null)} className={secondaryBtn}>Cancel</button>
          <button type="button" disabled={busy || !reason.trim()} onClick={async () => { if (await run({ action: "suspend", suspended: true, reason })) setDialog(null); }} className={dangerBtn}>
            {busy ? <Spinner /> : null} Suspend
          </button>
        </div>
      </Modal>

      {/* Plan */}
      <Modal open={dialog === "plan"} onOpenChange={(v) => !v && setDialog(null)} title="Give or change plan" description="Takes effect immediately on the agent's account.">
        <div className="space-y-3">
          <Field label="Plan" htmlFor="plan-id">
            <select id="plan-id" value={planForm.plan} onChange={(e) => setPlanForm({ ...planForm, plan: e.target.value })} className={inputCls}>
              <option value="silver">Silver (free)</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
            </select>
          </Field>
          {planForm.plan !== "silver" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Billing" htmlFor="plan-cycle" hint="Sets the grace period: 2 days monthly, 5 days yearly.">
                <select id="plan-cycle" value={planForm.cycle} onChange={(e) => setPlanForm({ ...planForm, cycle: e.target.value })} className={inputCls}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </Field>
              <Field label="Ends on" htmlFor="plan-end">
                <input id="plan-end" type="date" value={planForm.expiresAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setPlanForm({ ...planForm, expiresAt: e.target.value })} className={inputCls} />
              </Field>
            </div>
          ) : null}
          <Field label="Reason (required)" htmlFor="plan-reason">
            <input id="plan-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Complimentary month for launch partner" className={inputCls} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setDialog(null)} className={secondaryBtn}>Cancel</button>
          <button
            type="button"
            disabled={busy || !reason.trim() || (planForm.plan !== "silver" && !planForm.expiresAt)}
            onClick={async () => {
              const expiresAt = planForm.expiresAt ? `${planForm.expiresAt}T23:59:59+05:30` : undefined;
              if (await run({ action: "plan", plan: planForm.plan, cycle: planForm.cycle, expiresAt, reason })) setDialog(null);
            }}
            className={primaryBtn}
          >
            {busy ? <Spinner /> : null} Save plan
          </button>
        </div>
      </Modal>

      {/* Email */}
      <Modal open={dialog === "email"} onOpenChange={(v) => !v && setDialog(null)} title="Change email" description={`Current: ${agent.email}. Only change it after confirming the request came from the account owner.`}>
        <Field label="New email" htmlFor="new-email">
          <input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setDialog(null)} className={secondaryBtn}>Cancel</button>
          <button type="button" disabled={busy || !email.trim()} onClick={async () => { if (await run({ action: "email", email })) setDialog(null); }} className={primaryBtn}>
            {busy ? <Spinner /> : null} Change email
          </button>
        </div>
      </Modal>

      {/* Delete */}
      <Modal open={dialog === "delete"} onOpenChange={(v) => !v && setDialog(null)} title={`Delete ${agent.name}?`} description="Permanently deletes the account and every document, customer, payment and message. This can't be undone. Export the data first if it may be needed.">
        <div className="space-y-3">
          <Field label="Reason (recorded in the audit log)" htmlFor="del-reason">
            <input id="del-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} maxLength={300} />
          </Field>
          <Field label={`Type ${agent.email} to confirm`} htmlFor="del-confirm">
            <input id="del-confirm" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className={inputCls} autoComplete="off" />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setDialog(null)} className={secondaryBtn}>Cancel</button>
          <button
            type="button"
            disabled={busy || !reason.trim() || confirmEmail.trim().toLowerCase() !== agent.email}
            onClick={async () => {
              if (await run({ action: "delete", confirmEmail, reason })) {
                setDialog(null);
                router.replace("/agents");
              }
            }}
            className={dangerBtn}
          >
            {busy ? <Spinner /> : null} Delete permanently
          </button>
        </div>
      </Modal>
    </>
  );
}

export function AgentNotes({ agentId, canAdd, notes }: { agentId: string; canAdd: boolean; notes: { id: string; admin_name: string; body: string; created_at: string }[] }) {
  const { run, busy } = useAgentAction(agentId);
  const [text, setText] = useState("");
  return (
    <div>
      {canAdd ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run({ action: "note", body: text })) setText("");
          }}
          className="mb-4 flex gap-2"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Add a note for other admins…" className={inputCls} aria-label="New note" />
          <button type="submit" disabled={busy || !text.trim()} className={primaryBtn}>
            {busy ? <Spinner /> : null} Add
          </button>
        </form>
      ) : null}
      {notes.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-[var(--muted)] p-3">
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">{n.admin_name} · {timeAgo(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
