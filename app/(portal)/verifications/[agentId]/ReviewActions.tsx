"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Card, CardTitle, Field, Spinner, dangerBtn, inputCls, primaryBtn, secondaryBtn } from "@/components/ui";
import { Modal } from "@/components/modal";
import type { VerificationStatus } from "@/lib/verification";

type Action = "check" | "approve" | "deny";

export default function ReviewActions({ agentId, token, status, canCheck, canDecide }: { agentId: string; token: string; status: VerificationStatus; canCheck: boolean; canDecide: boolean }) {
  const router = useRouter();
  const [acting, setActing] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [confirmUnchecked, setConfirmUnchecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const toCheck = status === "pending" || status === "changes_pending";
  const open = toCheck || status === "checked" || status === "changes_checked";

  const submit = async () => {
    if (!acting) return;
    setBusy(true);
    const r = await api(`/api/verifications/${agentId}`, { json: { action: acting, token, note, confirmUnchecked } });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error?.message ?? "Something went wrong.");
      if (r.error?.code === "STALE") router.refresh();
      return;
    }
    toast.success(r.message ?? "Saved.");
    setActing(null);
    router.refresh();
  };

  const start = (a: Action) => {
    setActing(a);
    setNote("");
    setConfirmUnchecked(false);
  };

  if (!open) {
    return (
      <Card>
        <CardTitle>Decision</CardTitle>
        <p className="text-sm text-[var(--muted-foreground)]">
          {status === "approved" ? "Approved. If the agent changes their details, they come back here for review." : status === "denied" ? "Denied. When the agent updates their profile, it comes back here automatically." : "The agent hasn't completed their profile yet."}
        </p>
      </Card>
    );
  }

  const TITLES: Record<Action, string> = { check: "Mark as checked", approve: "Approve profile", deny: "Deny profile" };

  return (
    <>
      <Card>
        <CardTitle>Decision</CardTitle>
        <div className="flex flex-col gap-2">
          {toCheck && canCheck ? (
            <button type="button" onClick={() => start("check")} className={canDecide ? secondaryBtn : primaryBtn}>
              <ShieldCheck className="h-4 w-4" /> Mark as checked
            </button>
          ) : null}
          {canDecide ? (
            <>
              <button type="button" onClick={() => start("approve")} className={primaryBtn}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
              <button type="button" onClick={() => start("deny")} className={secondaryBtn}>
                <XCircle className="h-4 w-4 text-rose-500" /> Deny
              </button>
            </>
          ) : !toCheck ? (
            <p className="text-sm text-[var(--muted-foreground)]">Checked — waiting for an admin who can verify profiles to give the final decision.</p>
          ) : null}
        </div>
      </Card>

      <Modal open={!!acting} onOpenChange={(v) => !v && setActing(null)} title={acting ? TITLES[acting] : ""}>
        {acting ? (
          <div className="space-y-4">
            {acting === "approve" ? <p className="text-sm">The agent gets the Verified badge and can download and share PDFs right away.</p> : null}
            {acting === "approve" && toCheck ? (
              <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <input type="checkbox" checked={confirmUnchecked} onChange={(e) => setConfirmUnchecked(e.target.checked)} className="mt-0.5" />
                Nobody has checked these details yet. I&apos;ve checked them myself.
              </label>
            ) : null}
            <Field
              label={acting === "deny" ? "Reason (the agent sees this)" : "Note (optional, for other admins)"}
              htmlFor="review-note"
              hint={acting === "deny" ? "Be specific, e.g. “GSTIN doesn’t match the company name — please correct it.”" : undefined}
            >
              <textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className={`${inputCls} h-auto py-2`} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setActing(null)} className={secondaryBtn}>Cancel</button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || (acting === "deny" && !note.trim()) || (acting === "approve" && toCheck && !confirmUnchecked)}
                className={acting === "deny" ? dangerBtn : primaryBtn}
              >
                {busy ? <Spinner /> : null} {TITLES[acting]}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
