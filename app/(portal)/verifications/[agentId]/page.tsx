import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { isUuid, requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { PARTNER_LABELS } from "@/lib/agents";
import { REVIEW_COLUMNS, REVIEW_FIELDS, REVIEW_KEYS, STATUS_LABEL, fingerprint, fingerprintToken, type ReviewField, type VerificationStatus } from "@/lib/verification";
import { cn, formatDate } from "@/lib/utils";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";
import ReviewActions from "./ReviewActions";

export const metadata = { title: "Review profile" };

const GROUPS: { title: string; keys: ReviewField[] }[] = [
  { title: "Business", keys: ["companyName", "brandName", "partnerType", "partnerTypeOther", "gstNumber", "iataNumber"] },
  { title: "Contact", keys: ["name", "mobile", "landlineNumber", "address", "city", "state", "pincode"] },
  { title: "Bank & payment", keys: ["bankAccountHolder", "bankName", "bankAccountNumber", "bankIfscCode", "bankBranchAddress", "paymentUpi"] },
];

export default async function ReviewPage({ params }: { params: Promise<{ agentId: string }> }) {
  const admin = await requirePage("agents.verify");
  const { agentId } = await params;
  if (!isUuid(agentId)) notFound();

  const { data: row } = await db()
    .from("users")
    .select(`id,email,created_at,verification_status,verification_submitted_at,verification_checked_by,verification_checked_at,verification_decided_by,verification_decided_at,verification_note,verification_changes,${REVIEW_COLUMNS}`)
    .eq("id", agentId)
    .maybeSingle();
  if (!row) notFound();
  const r = row as unknown as Record<string, unknown> & { verification_status: VerificationStatus; verification_changes: string[] };

  const adminIds = [r.verification_checked_by, r.verification_decided_by].filter(Boolean) as string[];
  const { data: admins } = adminIds.length ? await db().from("admins").select("id,name").in("id", adminIds) : { data: [] };
  const who = new Map(((admins ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));

  const changed = new Set(r.verification_changes ?? []);
  const token = fingerprintToken(fingerprint(r));
  const value = (k: ReviewField) => {
    const v = String(r[REVIEW_FIELDS[k].column] ?? "").trim();
    if (k === "partnerType") return v ? PARTNER_LABELS[v] ?? v : "";
    return v;
  };
  const missing = REVIEW_KEYS.filter((k) => ["companyName", "brandLogo", "address", "mobile"].includes(k) && !value(k));

  return (
    <>
      <Link href="/verifications" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> All reviews
      </Link>
      <PageHeader
        title={value("companyName") || value("name") || "Agent"}
        description={`${r.email as string} · joined ${formatDate(r.created_at as string)}`}
        actions={<Link href={`/agents/${agentId}`} className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">Agent page →</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {changed.size ? (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              This agent was already approved and has changed the highlighted details. They keep their access while you review.
            </p>
          ) : null}

          <Card>
            <CardTitle>Logo & stamp</CardTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["brandLogo", "companyStamp"] as const).map((k) => (
                <div key={k} className={cn("rounded-xl border p-3", changed.has(k) ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/40" : "border-[var(--border)]")}>
                  <p className="mb-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    {REVIEW_FIELDS[k].label} {changed.has(k) ? <Badge tone="amber">Changed</Badge> : null}
                  </p>
                  {value(k).startsWith("data:image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={value(k)} alt={REVIEW_FIELDS[k].label} className="mx-auto max-h-32 rounded-lg bg-white object-contain p-2" />
                  ) : (
                    <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">Not added</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {GROUPS.map((g) => (
            <Card key={g.title}>
              <CardTitle>{g.title}</CardTitle>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {g.keys.map((k) => (
                  <div key={k} className={cn("rounded-lg px-2 py-1", changed.has(k) && "bg-amber-50 ring-1 ring-amber-300 dark:bg-amber-950/50 dark:ring-amber-800")}>
                    <dt className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                      {REVIEW_FIELDS[k].label} {changed.has(k) ? <Badge tone="amber">Changed</Badge> : null}
                    </dt>
                    <dd className="break-words text-sm font-medium">{value(k) || "—"}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Status</CardTitle>
            <Badge tone={r.verification_status === "approved" ? "green" : r.verification_status === "denied" ? "red" : "amber"}>{STATUS_LABEL[r.verification_status]}</Badge>
            <ul className="mt-3 space-y-1 text-xs text-[var(--muted-foreground)]">
              <li>Submitted: {formatDate(r.verification_submitted_at as string | null, true)}</li>
              {r.verification_checked_at ? <li>Checked by {who.get(r.verification_checked_by as string) ?? "an admin"} · {formatDate(r.verification_checked_at as string, true)}</li> : null}
              {r.verification_decided_at ? <li>Decided by {who.get(r.verification_decided_by as string) ?? "an admin"} · {formatDate(r.verification_decided_at as string, true)}</li> : null}
              {r.verification_status === "denied" && r.verification_note ? <li className="text-rose-600 dark:text-rose-300">Reason given: {r.verification_note as string}</li> : null}
            </ul>
            {missing.length ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Missing: {missing.map((k) => REVIEW_FIELDS[k].label).join(", ")}</p> : null}
          </Card>

          <ReviewActions
            agentId={agentId}
            token={token}
            status={r.verification_status}
            canCheck={can(admin, "agents.verify")}
            canDecide={can(admin, "agents.approve")}
          />

          <Card>
            <CardTitle>What to check</CardTitle>
            <ul className="list-disc space-y-1.5 pl-4 text-xs text-[var(--muted-foreground)]">
              <li>GSTIN is valid and its legal name matches the company name (check on the GST portal).</li>
              <li>Bank account holder matches the company or owner name; IFSC matches the bank and branch.</li>
              <li>Logo and stamp belong to this business and aren&apos;t copied from another brand.</li>
              <li>Address and mobile number look genuine — call the agent if anything is unclear.</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
