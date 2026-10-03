import Link from "next/link";
import { BadgeCheck, ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { AGENT_LIST_COLUMNS, PARTNER_LABELS, withCycle, type AgentRow } from "@/lib/agents";
import { planName, subscriptionState } from "@/lib/plans";
import { formatDate } from "@/lib/utils";
import { Badge, EmptyState, PageHeader, Table, inputCls, secondaryBtn, type Tone } from "@/components/ui";

export const metadata = { title: "Agents" };

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, Tone> = { ACTIVE: "green", INACTIVE: "neutral", SUSPENDED: "red" };
const SUB_TONE: Record<string, Tone> = { active: "brand", grace: "amber", lapsed: "red", free: "neutral" };

type Search = { q?: string; status?: string; plan?: string; verified?: string; page?: string };

export default async function AgentsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePage("agents.view");
  const sp = await searchParams;
  // Characters that would break the PostgREST filter syntax are dropped from the search text.
  const q = (sp.q ?? "").replace(/[,()%"\\*]/g, " ").trim().slice(0, 80);
  const page = Math.max(1, Number(sp.page) || 1);

  let query = db().from("users").select(await withCycle(AGENT_LIST_COLUMNS), { count: "exact" });
  if (q) query = query.or(["name", "email", "company_name", "brand_name", "mobile"].map((c) => `${c}.ilike."%${q}%"`).join(","));
  if (["ACTIVE", "INACTIVE", "SUSPENDED"].includes(sp.status ?? "")) query = query.eq("status", sp.status!);
  if (["silver", "gold", "platinum"].includes(sp.plan ?? "")) query = query.eq("subscription_plan", sp.plan!);
  if (sp.verified === "yes") query = query.eq("is_verified", true);
  if (sp.verified === "no") query = query.eq("is_verified", false);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const agents = (data ?? []) as unknown as AgentRow[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    const next = { ...sp, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, String(v));
    return `/agents?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="Agents" description={`${total.toLocaleString("en-IN")} agent${total === 1 ? "" : "s"}${q ? ` matching “${q}”` : ""}`} />

      <form className="mb-5 grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search agents</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input name="q" defaultValue={q} placeholder="Name, email, company or mobile" className={`${inputCls} pl-9`} />
        </label>
        <select name="status" defaultValue={sp.status ?? ""} className={inputCls} aria-label="Status">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <select name="plan" defaultValue={sp.plan ?? ""} className={inputCls} aria-label="Plan">
          <option value="">Any plan</option>
          <option value="silver">Silver</option>
          <option value="gold">Gold</option>
          <option value="platinum">Platinum</option>
        </select>
        <select name="verified" defaultValue={sp.verified ?? ""} className={inputCls} aria-label="Verification">
          <option value="">Verified or not</option>
          <option value="yes">Verified</option>
          <option value="no">Not verified</option>
        </select>
        <button type="submit" className={secondaryBtn}>Filter</button>
      </form>

      {error ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">Could not load agents: {error.message}</p>
      ) : agents.length === 0 ? (
        <EmptyState icon={Users} title="No agents found" text="Try a different search or clear the filters." />
      ) : (
        <>
          <Table head={["Agent", "Type", "Status", "Plan", "Joined"]}>
            {agents.map((a) => {
              const sub = subscriptionState(a);
              return (
                <tr key={a.id} className="hover:bg-[var(--muted)]">
                  <td className="px-4 py-3">
                    <Link href={`/agents/${a.id}`} className="block">
                      <span className="flex items-center gap-1.5 font-semibold hover:text-brand-600 dark:hover:text-brand-300">
                        {a.company_name || a.name}
                        {a.is_verified ? <BadgeCheck className="h-4 w-4 text-sky-500" aria-label="Verified" /> : null}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">{a.name} · {a.email}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{a.partner_type ? PARTNER_LABELS[a.partner_type] ?? a.partner_type : "—"}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONE[a.status] ?? "neutral"} className="capitalize">{a.status.toLowerCase()}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge tone={SUB_TONE[sub.status]}>{planName(sub.paidPlan ?? "silver")}{sub.status === "grace" ? " · grace" : sub.status === "lapsed" ? " · ended" : ""}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatDate(a.created_at)}</td>
                </tr>
              );
            })}
          </Table>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link href={link({ page: String(page - 1) })} className={secondaryBtn}><ChevronLeft className="h-4 w-4" /> Previous</Link> : null}
              {page < pages ? <Link href={link({ page: String(page + 1) })} className={secondaryBtn}>Next <ChevronRight className="h-4 w-4" /></Link> : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
