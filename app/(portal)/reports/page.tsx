import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { withCycle } from "@/lib/agents";
import { SERVICE_LABELS, planName, subscriptionState } from "@/lib/plans";
import { formatDate, formatInr, nowMs } from "@/lib/utils";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui";

export const metadata = { title: "Reports" };

const DAY = 86_400_000;

function Bars({ rows, format = (n: number) => n.toLocaleString("en-IN") }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-[var(--muted-foreground)]">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-[var(--muted)]">
            <span className="block h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-neon" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="w-16 text-right font-semibold tabular-nums">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage() {
  const admin = await requirePage("reports.activity");
  const revenue = can(admin, "reports.revenue");
  const now = nowMs();
  const since56 = new Date(now - 56 * DAY).toISOString();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since14 = new Date(now - 14 * DAY).toISOString().slice(0, 10);
  const since6m = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString();

  const [users, docs, ai, payments] = await Promise.all([
    db().from("users").select(await withCycle("id,created_at,subscription_plan,subscription_expires_at,name,company_name")),
    db().from("agent_documents").select("kind").gte("created_at", since30).limit(50000),
    db().from("ai_usage_daily").select("day,calls,cost_micros").gte("day", since14).order("day"),
    revenue ? db().from("plan_payments").select("amount_inr,status,plan_id,updated_at").in("status", ["approved", "refunded"]).gte("updated_at", since6m) : Promise.resolve({ data: [] }),
  ]);

  const agents = (users.data ?? []) as unknown as { id: string; created_at: string; subscription_plan: string; subscription_expires_at: string | null; subscription_cycle?: string | null; name: string; company_name: string | null }[];

  // Sign-ups per week, last 8 weeks (oldest first).
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = now - (8 - i) * 7 * DAY;
    const end = start + 7 * DAY;
    return { label: `w/c ${formatDate(new Date(start).toISOString()).replace(/ \d{4}$/, "")}`, value: agents.filter((a) => { const t = new Date(a.created_at).getTime(); return t >= start && t < end; }).length };
  });
  const recent = agents.filter((a) => a.created_at >= since56).length;

  const byKind = new Map<string, number>();
  for (const d of (docs.data ?? []) as { kind: string }[]) byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1);
  const kindRows = Object.entries(SERVICE_LABELS).map(([k, label]) => ({ label, value: byKind.get(k) ?? 0 }));

  const aiRows = ((ai.data ?? []) as { day: string; calls: number; cost_micros: number }[]).map((r) => ({ label: formatDate(r.day).replace(/ \d{4}$/, ""), value: r.calls, cost: r.cost_micros }));
  const aiCost = aiRows.reduce((s, r) => s + r.cost, 0) / 1e6;

  const subs = agents.map((a) => ({ a, s: subscriptionState(a, now) }));
  const mix = (["silver", "gold", "platinum"] as const).map((p) => ({ label: planName(p), value: subs.filter(({ s }) => s.plan === p).length }));

  // Revenue by month (approved minus refunded).
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - 5 + i, 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), value: 0 };
  });
  for (const p of (payments.data ?? []) as { amount_inr: number; status: string; updated_at: string }[]) {
    const d = new Date(p.updated_at);
    const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (m && p.status === "approved") m.value += p.amount_inr;
  }
  const renewals = subs
    .filter(({ s }) => (s.status === "active" && s.daysLeft !== null && s.daysLeft <= 30) || s.status === "grace")
    .sort((x, y) => (x.s.expiresAt ?? "").localeCompare(y.s.expiresAt ?? ""));

  return (
    <>
      <PageHeader title="Reports" description={revenue ? "Activity, plans and revenue." : "Activity and usage across Voyenta."} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle hint={`${recent} in the last 8 weeks`}>New agents per week</CardTitle>
          <Bars rows={weeks} />
        </Card>
        <Card>
          <CardTitle hint="Last 30 days">Documents created</CardTitle>
          <Bars rows={kindRows} />
        </Card>
        <Card>
          <CardTitle hint={revenue ? `$${aiCost.toFixed(2)} spent in 14 days` : "Last 14 days"}>Upload auto-fill use</CardTitle>
          {aiRows.length === 0 ? <p className="text-sm text-[var(--muted-foreground)]">No auto-fill use recorded (or migration 0004 hasn&apos;t been run).</p> : <Bars rows={aiRows} />}
        </Card>
        <Card>
          <CardTitle hint="Plan each agent can use now">Agents by plan</CardTitle>
          <Bars rows={mix} />
        </Card>

        {revenue ? (
          <>
            <Card>
              <CardTitle hint="Approved plan payments">Revenue by month</CardTitle>
              <Bars rows={months} format={formatInr} />
            </Card>
            <Card>
              <CardTitle hint="Next 30 days, plus plans in grace">Renewals due</CardTitle>
              {renewals.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No paid plans end in the next 30 days.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] text-sm">
                  {renewals.slice(0, 15).map(({ a, s }) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                      <Link href={`/agents/${a.id}`} className="truncate font-medium hover:text-brand-600 dark:hover:text-brand-300">{a.company_name || a.name}</Link>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        {planName(s.paidPlan)} · {formatDate(s.expiresAt)}
                        {s.status === "grace" ? <Badge tone="amber">Grace</Badge> : <Badge tone="brand">{s.daysLeft} d</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
