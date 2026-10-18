import "server-only";
import { db } from "@/lib/db";
import { agentNames } from "@/lib/agents";
import { can } from "@/lib/permissions";
import { formatInr } from "@/lib/utils";
import type { AdminRecord } from "@/lib/auth/guard";

/**
 * What needs an admin's attention right now, for the notification bell: agent profiles waiting for
 * review, tickets (and bug reports) whose last message is from the agent, new callback requests,
 * online plan payments from the last two days and Razorpay refunds that failed.
 * Derived live from the tables, so it always matches the sidebar counts and clears itself once
 * someone handles the item (payments simply age out).
 */
export type NotificationKind = "ticket" | "bug" | "callback" | "payment" | "verification";

export interface AdminNotification {
  /** Changes whenever the item gets new activity, so a new message re-notifies. */
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  href: string;
}

const LIMIT = 30;
const PAYMENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const SLOT: Record<string, string> = { morning: "morning", afternoon: "afternoon", evening: "evening" };

type Row<T> = { data: T[] | null; error: unknown };
const rows = <T,>(r: Row<T>): T[] => (r.error ? [] : r.data ?? []);

interface ReviewRow {
  id: string;
  name: string | null;
  company_name: string | null;
  verification_status: string;
  verification_submitted_at: string | null;
  verification_checked_at: string | null;
}

/** Review statuses an admin can act on: checking needs agents.verify, the decision agents.approve. */
const TO_CHECK = ["pending", "changes_pending"];
const TO_DECIDE = ["checked", "changes_checked"];

interface OnlinePaymentRow {
  id: string;
  agent_id: string;
  plan_id: string;
  billing_cycle?: string;
  amount_inr: number;
  status: string;
  payment_method: string | null;
  paid_at: string | null;
  refund_status: string | null;
  refunded_at: string | null;
}

export async function buildNotifications(admin: AdminRecord): Promise<{ items: AdminNotification[]; counts: Record<"tickets" | "callbacks", number> }> {
  const support = can(admin, "support.reply");
  const payments = can(admin, "payments.view");
  const reviewStatuses = [...(can(admin, "agents.verify") || can(admin, "agents.approve") ? TO_CHECK : []), ...(can(admin, "agents.approve") ? TO_DECIDE : [])];
  const none = Promise.resolve([]);

  const [reviews, tickets, callbacks, online] = await Promise.all([
    // Errors (e.g. before migration 0007) just mean no review notifications.
    reviewStatuses.length
      ? db()
          .from("users")
          .select("id,name,company_name,verification_status,verification_submitted_at,verification_checked_at")
          .in("verification_status", reviewStatuses)
          .order("verification_submitted_at", { ascending: false, nullsFirst: false })
          .limit(LIMIT)
          .then((r) => rows(r as Row<ReviewRow>))
      : none,
    support
      ? db()
          .from("support_tickets")
          .select("id,number,agent_id,kind,subject,last_reply_at,created_at")
          .eq("last_reply_from", "agent")
          .in("status", ["open", "in_progress", "waiting"])
          .order("last_reply_at", { ascending: false })
          .limit(LIMIT)
          .then((r) => rows(r as Row<{ id: string; number: number; agent_id: string; kind: "ticket" | "bug"; subject: string; last_reply_at: string; created_at: string }>))
      : none,
    support
      ? db()
          .from("callback_requests")
          .select("id,agent_id,topic,preferred_date,preferred_slot,created_at")
          .eq("status", "requested")
          .order("created_at", { ascending: false })
          .limit(LIMIT)
          .then((r) => rows(r as Row<{ id: string; agent_id: string; topic: string; preferred_date: string; preferred_slot: string; created_at: string }>))
      : none,
    // Errors (e.g. before migration 0011 adds these columns) just mean no payment notifications.
    payments
      ? db()
          .from("plan_payments")
          .select("id,agent_id,plan_id,amount_inr,status,payment_method,paid_at,refund_status,refunded_at")
          .eq("provider", "razorpay")
          .or(`paid_at.gte.${new Date(Date.now() - PAYMENT_WINDOW_MS).toISOString()},refund_status.eq.failed`)
          .order("paid_at", { ascending: false })
          .limit(LIMIT)
          .then((r) => rows(r as Row<OnlinePaymentRow>))
      : none,
  ]);

  const names = await agentNames([...tickets.map((t) => t.agent_id), ...callbacks.map((c) => c.agent_id), ...online.map((p) => p.agent_id)]);
  const who = (id: string) => {
    const n = names.get(id);
    return n?.company || n?.name || "An agent";
  };
  const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const plan = (p: string) => (p === "gold" ? "Gold" : p === "platinum" ? "Platinum" : p);

  const items: AdminNotification[] = [
    ...reviews.map((u) => {
      const agency = u.company_name?.trim() || u.name?.trim() || "An agent";
      const checked = TO_DECIDE.includes(u.verification_status);
      const changes = u.verification_status.startsWith("changes_");
      const at = (checked ? u.verification_checked_at : u.verification_submitted_at) ?? u.verification_submitted_at ?? new Date(0).toISOString();
      return {
        id: `review:${u.id}:${u.verification_status}:${at}`,
        kind: "verification" as const,
        title: checked ? `${agency} is checked and ready to verify` : changes ? `${agency} changed verified details` : `New profile to review: ${agency}`,
        body: checked ? "Give the final decision so the agent is notified." : "Review the details and verify the profile — the agent is waiting to hear back.",
        at,
        href: `/verifications/${u.id}`,
      };
    }),
    ...tickets.map((t) => {
      const isNew = t.last_reply_at === t.created_at || Date.parse(t.last_reply_at) - Date.parse(t.created_at) < 5000;
      return {
        id: `ticket:${t.id}:${t.last_reply_at}`,
        kind: t.kind === "bug" ? ("bug" as const) : ("ticket" as const),
        title: `${t.kind === "bug" ? "Bug report" : isNew ? "New ticket" : "New reply"} #${t.number} from ${who(t.agent_id)}`,
        body: clip(t.subject),
        at: t.last_reply_at,
        href: `/tickets/${t.id}`,
      };
    }),
    ...callbacks.map((c) => ({
      id: `callback:${c.id}`,
      kind: "callback" as const,
      title: `${who(c.agent_id)} asked for a callback`,
      body: clip(`${c.topic} · ${new Date(`${c.preferred_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${SLOT[c.preferred_slot] ?? ""}`),
      at: c.created_at,
      href: "/callbacks?tab=requested",
    })),
    ...online
      .filter((p) => p.paid_at || p.refund_status === "failed")
      .map((p) =>
        p.refund_status === "failed"
          ? {
              id: `refund-failed:${p.id}`,
              kind: "payment" as const,
              title: `Refund failed for ${who(p.agent_id)}`,
              body: `${formatInr(p.amount_inr)} · ${plan(p.plan_id)} — retry it from the Razorpay dashboard`,
              at: p.refunded_at ?? p.paid_at ?? new Date().toISOString(),
              href: "/payments?tab=refunded",
            }
          : {
              id: `paid:${p.id}`,
              kind: "payment" as const,
              title: `${who(p.agent_id)} paid ${formatInr(p.amount_inr)} online`,
              body: `${plan(p.plan_id)} plan activated${p.payment_method ? ` · ${p.payment_method}` : ""}`,
              at: p.paid_at!,
              href: "/payments?tab=approved",
            }
      ),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, LIMIT);

  return { items, counts: { tickets: tickets.length, callbacks: callbacks.length } };
}
