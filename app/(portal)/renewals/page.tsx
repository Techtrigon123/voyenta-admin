import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { withCycle } from "@/lib/agents";
import { GRACE_DAYS, planName, subscriptionState, type SubscriptionState } from "@/lib/plans";
import { formatDate } from "@/lib/utils";
import { Badge, EmptyState, PageHeader, Table, type Tone } from "@/components/ui";
import { NavBar } from "@/components/ui/tubelight-navbar";

export const metadata = { title: "Plan renewals" };

const DAY_MS = 86_400_000;
/** Plans ending within this many days count as "ending soon" (matches the agents' renewal reminders). */
const SOON_DAYS = 7;
/** Ended plans stay on the list this long after their grace period, so follow-ups aren't lost. */
const ENDED_DAYS = 30;
const LONGEST_GRACE = Math.max(...Object.values(GRACE_DAYS).flatMap((c) => Object.values(c)));

const TABS = [
  { key: "soon", label: `Ending in ${SOON_DAYS} days` },
  { key: "grace", label: "In grace period" },
  { key: "ended", label: `Ended (last ${ENDED_DAYS} days)` },
] as const;
type TabKey = (typeof TABS)[number]["key"];

interface Row {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
  mobile: string | null;
  status: string;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  subscription_cycle?: string | null;
}

const STATUS_TONE: Record<string, Tone> = { ACTIVE: "green", INACTIVE: "neutral", SUSPENDED: "red" };

function tabOf(s: SubscriptionState, now: number): TabKey | null {
  if (s.status === "active" && s.daysLeft != null && s.daysLeft <= SOON_DAYS) return "soon";
  if (s.status === "grace") return "grace";
  if (s.status === "lapsed" && s.graceEndsAt && now - Date.parse(s.graceEndsAt) <= ENDED_DAYS * DAY_MS) return "ended";
  return null;
}

/** Paid plans whose end date falls in the window this page shows. */
async function loadPlans() {
  const now = Date.now();
  const { data, error } = await db()
    .from("users")
    .select(await withCycle("id,name,email,company_name,mobile,status,subscription_plan,subscription_expires_at"))
    .in("subscription_plan", ["gold", "platinum"])
    .gte("subscription_expires_at", new Date(now - (LONGEST_GRACE + ENDED_DAYS) * DAY_MS).toISOString())
    .lte("subscription_expires_at", new Date(now + SOON_DAYS * DAY_MS).toISOString())
    .order("subscription_expires_at", { ascending: true })
    .limit(500);
  return { all: ((data ?? []) as unknown as Row[]).map((r) => ({ r, s: subscriptionState(r, now) })), now, error };
}

/**
 * Gold and Platinum plans that need attention: ending within a week, in their grace period, or
 * recently ended. After the grace period the agent's paid services stop by themselves (the account
 * falls back to Silver); from the agent's page an admin can also end a plan early, switch services
 * off or suspend the account.
 */
export default async function RenewalsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePage("agents.view");
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === requested) ?? TABS[0];
  const { all, now, error } = await loadPlans();
  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter(({ s }) => tabOf(s, now) === t.key).length])) as Record<TabKey, number>;
  const rows = all.filter(({ s }) => tabOf(s, now) === tab.key);
  if (tab.key === "ended") rows.reverse(); // most recently ended first

  return (
    <>
      <PageHeader
        title="Plan renewals"
        description="Gold and Platinum plans ending soon, in their grace period, or recently ended. When the grace period runs out, paid services stop automatically and the account moves to Silver. Open an agent to remind them, end a plan early, switch services off or suspend the account."
      />
      <NavBar
        className="mb-5"
        layoutId="renewal-tabs"
        items={TABS.map((t) => ({ name: `${t.label} (${counts[t.key]})`, url: `/renewals?tab=${t.key}` }))}
        active={`${tab.label} (${counts[tab.key]})`}
      />

      {error ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">Could not load plans: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing here"
          text={tab.key === "soon" ? "No plans end in the next week." : tab.key === "grace" ? "No agent is in a grace period right now." : "No plans ended in the last 30 days."}
        />
      ) : (
        <Table head={["Agent", "Plan", "Ends on", "Grace until", tab.key === "ended" ? "Services stopped" : "Days left", "Account", ""]}>
          {rows.map(({ r, s }) => (
            <tr key={r.id}>
              <td className="px-4 py-3">
                <p className="font-semibold">{r.company_name || r.name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {r.email}
                  {r.mobile ? ` · ${r.mobile}` : ""}
                </p>
              </td>
              <td className="px-4 py-3">
                <Badge tone={s.paidPlan === "platinum" ? "blue" : "amber"}>{planName(s.paidPlan)}</Badge>
                <span className="ml-1.5 text-xs capitalize text-[var(--muted-foreground)]">{s.cycle}</span>
              </td>
              <td className="px-4 py-3">{formatDate(s.expiresAt)}</td>
              <td className="px-4 py-3">
                {formatDate(s.graceEndsAt)}
                <span className="block text-xs text-[var(--muted-foreground)]">{GRACE_DAYS[s.paidPlan ?? "gold"][s.cycle ?? "yearly"]}-day grace</span>
              </td>
              <td className="px-4 py-3">
                {tab.key === "ended" ? (
                  <Badge tone="red">Moved to Silver · {formatDate(s.graceEndsAt)}</Badge>
                ) : (
                  <Badge tone={tab.key === "grace" || (s.daysLeft ?? 99) <= 1 ? "red" : "amber"}>
                    {s.daysLeft} day{s.daysLeft === 1 ? "" : "s"} {tab.key === "grace" ? "of grace" : "left"}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/agents/${r.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                  Manage
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
