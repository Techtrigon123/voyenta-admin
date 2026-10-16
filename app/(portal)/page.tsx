import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CreditCard, FileText, IndianRupee, Inbox, MessageCircle, UserCheck, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { agentNames, withCycle } from "@/lib/agents";
import { openReviewCount } from "@/lib/queries";
import { planName, subscriptionState } from "@/lib/plans";
import { formatInr, nowMs, timeAgo } from "@/lib/utils";
import { Badge, Card, CardTitle, PageHeader, StatCard } from "@/components/ui";

export const metadata = { title: "Overview" };

const DAY = 86_400_000;

export default async function OverviewPage() {
  const admin = await requirePage();
  const showRevenue = can(admin, "reports.revenue");
  const now = nowMs();
  const since7 = new Date(now - 7 * DAY).toISOString();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [users, docs30, pending, contactNew, approvedMonth, reviews] = await Promise.all([
    db().from("users").select(await withCycle("id,status,created_at,subscription_plan,subscription_expires_at")),
    db().from("agent_documents").select("id", { count: "exact", head: true }).gte("created_at", since30),
    can(admin, "payments.view")
      ? db().from("plan_payments").select("id,agent_id,plan_id,amount_inr,created_at,reviewed_at").eq("status", "pending").order("created_at").limit(6)
      : Promise.resolve({ data: [] }),
    can(admin, "contact.manage")
      ? db().from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new")
      : Promise.resolve({ count: 0 }),
    showRevenue
      ? db().from("plan_payments").select("amount_inr").eq("status", "approved").gte("updated_at", monthStart)
      : Promise.resolve({ data: [] }),
    can(admin, "agents.verify") ? openReviewCount(can(admin, "agents.approve")).catch(() => 0) : Promise.resolve(0),
  ]);

  const agents = (users.data ?? []) as unknown as { id: string; status: string; created_at: string; subscription_plan: string; subscription_expires_at: string | null; subscription_cycle?: string | null }[];
  const subs = agents.map((a) => subscriptionState(a, now));
  const paid = subs.filter((s) => s.status === "active" && s.paidPlan).length;
  const grace = subs.filter((s) => s.status === "grace").length;
  const expiringSoon = subs.filter((s) => s.status === "active" && s.daysLeft !== null && s.daysLeft <= 7).length;
  const revenue = ((approvedMonth.data ?? []) as { amount_inr: number }[]).reduce((s, p) => s + p.amount_inr, 0);
  const pendingRows = (pending.data ?? []) as { id: string; agent_id: string; plan_id: string; amount_inr: number; created_at: string; reviewed_at: string | null }[];
  const names = await agentNames(pendingRows.map((p) => p.agent_id));

  return (
    <>
      <PageHeader back={false} title={`Hello, ${admin.name.split(" ")[0]}`} description={admin.role === "master" ? "Everything happening on Vouchlio, at a glance." : "Your support and operations work for today."} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Agents" value={agents.length.toLocaleString("en-IN")} hint={`${agents.filter((a) => a.created_at >= since7).length} joined this week`} icon={Users} />
        <StatCard label="Active agents" value={agents.filter((a) => a.status === "ACTIVE").length.toLocaleString("en-IN")} hint={`${agents.filter((a) => a.status === "SUSPENDED").length} suspended`} icon={UserCheck} tone="green" />
        <StatCard label="Documents (30 days)" value={(docs30.count ?? 0).toLocaleString("en-IN")} hint="Created by all agents" icon={FileText} />
        {showRevenue ? (
          <StatCard label="Revenue this month" value={formatInr(revenue)} hint={`${paid} paid plans active`} icon={IndianRupee} tone="green" />
        ) : (
          <StatCard label="Waiting for you" value={pendingRows.length + reviews} hint={`${reviews} profile${reviews === 1 ? "" : "s"} to check · payments`} icon={AlertTriangle} tone="amber" />
        )}
      </div>

      {showRevenue ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Plans in grace period" value={grace} hint="Ended — still working, renewal due" icon={CalendarClock} tone="amber" />
          <StatCard label="Ending within 7 days" value={expiringSoon} hint="Active paid plans" icon={CalendarClock} />
          <StatCard label="Profile reviews" value={reviews} hint="Waiting for a check or your approval" icon={UserCheck} tone="amber" />
          <StatCard label="Contact messages" value={contactNew.count ?? 0} hint="New, not handled yet" icon={Inbox} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {can(admin, "payments.view") ? (
          <Card>
            <CardTitle hint={<Link href="/payments" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-300">All payments <ArrowRight className="h-3 w-3" /></Link>}>
              <span className="inline-flex items-center gap-2"><CreditCard className="h-4 w-4 text-brand-500" /> Payments awaiting a decision</span>
            </CardTitle>
            {pendingRows.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Nothing waiting. 🎉</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {pendingRows.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{names.get(p.agent_id)?.company || names.get(p.agent_id)?.name || "Agent"}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">{planName(p.plan_id)} · {formatInr(p.amount_inr)} · {timeAgo(p.created_at)}</span>
                    </span>
                    {p.reviewed_at ? <Badge tone="blue">Checked</Badge> : <Badge tone="amber">To check</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

      </div>
    </>
  );
}
