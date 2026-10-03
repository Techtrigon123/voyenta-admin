import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { REVIEW_FIELDS, STATUS_LABEL, type ReviewField, type VerificationStatus } from "@/lib/verification";
import { cn, timeAgo } from "@/lib/utils";
import { Badge, EmptyState, PageHeader, type Tone } from "@/components/ui";

export const metadata = { title: "Profile reviews" };

const TABS = [
  { key: "to-check", label: "To check", statuses: ["pending", "changes_pending"] },
  { key: "checked", label: "Checked — awaiting approval", statuses: ["checked", "changes_checked"] },
  { key: "denied", label: "Denied", statuses: ["denied"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
] as const;

const TONE: Record<VerificationStatus, Tone> = {
  not_submitted: "neutral",
  pending: "amber",
  checked: "blue",
  approved: "green",
  changes_pending: "amber",
  changes_checked: "blue",
  denied: "red",
};

interface Row {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  verification_status: VerificationStatus;
  verification_submitted_at: string | null;
  verification_decided_at: string | null;
  verification_changes: string[];
  verification_note: string | null;
}

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await requirePage("agents.verify");
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === requested) ?? TABS[0];

  const { data, error } = await db()
    .from("users")
    .select("id,name,email,company_name,verification_status,verification_submitted_at,verification_decided_at,verification_changes,verification_note")
    .in("verification_status", [...tab.statuses])
    .order(tab.key === "approved" || tab.key === "denied" ? "verification_decided_at" : "verification_submitted_at", { ascending: tab.key === "to-check" || tab.key === "checked", nullsFirst: false })
    .limit(200);
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        title="Profile reviews"
        description={
          can(admin, "agents.approve")
            ? "Sub-admins check each agent's business and bank details; you approve or deny. Agents can download PDFs only once approved."
            : "Check each agent's business and bank details against their documents and mark them checked. A master admin gives the final approval."
        }
      />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/verifications?tab=${t.key}`}
            className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition", tab.key === t.key ? "bg-ink text-white dark:bg-brand-neon dark:text-ink" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          Could not load reviews: {error.message}. Has migration 0007_profile_verification.sql been run?
        </p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nothing here" text="Agents appear in “To check” as soon as they complete their profile, or change details after approval." />
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => {
            const changes = (r.verification_changes ?? []).map((f) => REVIEW_FIELDS[f as ReviewField]?.label ?? f);
            return (
              <li key={r.id}>
                <Link href={`/verifications/${r.id}`} className="anim-rise flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-brand-300">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink font-bold text-brand-neon">{(r.company_name || r.name).slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{r.company_name || r.name}</span>
                      <Badge tone={TONE[r.verification_status]}>{STATUS_LABEL[r.verification_status]}</Badge>
                    </span>
                    <span className="block truncate text-xs text-[var(--muted-foreground)]">
                      {r.email} · {tab.key === "approved" || tab.key === "denied" ? `decided ${timeAgo(r.verification_decided_at)}` : `submitted ${timeAgo(r.verification_submitted_at)}`}
                    </span>
                    {changes.length ? <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">Changed: {changes.join(", ")}</span> : null}
                    {r.verification_status === "denied" && r.verification_note ? <span className="mt-1 block text-xs text-rose-600 dark:text-rose-300">Reason: {r.verification_note}</span> : null}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
