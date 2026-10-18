import { notFound } from "next/navigation";
import { BadgeCheck, FileText, Lock } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { db } from "@/lib/db";
import { isUuid, requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { getAgent, PARTNER_LABELS } from "@/lib/agents";
import { GRACE_DAYS, SERVICE_LABELS, planName, subscriptionState } from "@/lib/plans";
import { formatDate, formatInr, timeAgo } from "@/lib/utils";
import { Badge, Card, CardTitle, type Tone } from "@/components/ui";
import AgentActions, { AgentNotes } from "./AgentActions";

export const metadata = { title: "Agent" };

const STATUS_TONE: Record<string, Tone> = { ACTIVE: "green", INACTIVE: "neutral", SUSPENDED: "red" };
const SUB_TONE: Record<string, Tone> = { active: "brand", grace: "amber", lapsed: "red", free: "neutral" };

export default async function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePage("agents.view");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const agent = await getAgent(id);
  if (!agent) notFound();

  const [counts, lastDoc, customers, payments, notes] = await Promise.all([
    db().rpc("agent_document_counts", { p_agent: id }),
    db().from("agent_documents").select("created_at").eq("agent_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db().from("customers").select("id", { count: "exact", head: true }).eq("agent_id", id),
    can(admin, "payments.view")
      ? db().from("plan_payments").select("id,plan_id,amount_inr,status,created_at").eq("agent_id", id).neq("status", "created").order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    db().from("agent_notes").select("id,admin_name,body,created_at").eq("agent_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  const docCounts = new Map(((counts.data ?? []) as { kind: string; count: number }[]).map((c) => [c.kind, Number(c.count)]));
  const totalDocs = [...docCounts.values()].reduce((a, b) => a + b, 0);
  const sub = subscriptionState(agent);
  const display = agent.company_name || agent.name;

  const info: [string, string | null | undefined][] = [
    ["Contact person", agent.name],
    ["Email", agent.email],
    ["Mobile", agent.mobile],
    ["Landline", agent.landline_number],
    ["Brand name", agent.brand_name],
    ["Business type", agent.partner_type === "other" ? agent.partner_type_other || "Other" : agent.partner_type ? PARTNER_LABELS[agent.partner_type] : null],
    ["GSTIN", agent.gst_number],
    ["IATA number", agent.iata_number],
    ["Address", [agent.address, agent.city, agent.state, agent.pincode, agent.country].filter(Boolean).join(", ")],
    ["Joined", formatDate(agent.created_at)],
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <BackButton fallback="/agents" label="Back to agents" />
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-xl font-bold text-brand-neon">{display.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-xl font-bold">
              {display} {agent.is_verified ? <BadgeCheck className="h-5 w-5 shrink-0 text-sky-500" aria-label="Verified" /> : null}
            </h1>
            <p className="truncate text-sm text-[var(--muted-foreground)]">{agent.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={STATUS_TONE[agent.status]} className="capitalize">{agent.status.toLowerCase()}</Badge>
              <Badge tone={agent.is_verified ? "blue" : "amber"}>{agent.is_verified ? "Verified" : "Not verified"}</Badge>
              <Badge tone={SUB_TONE[sub.status]}>{planName(sub.paidPlan ?? "silver")}{sub.status === "grace" ? " · in grace" : sub.status === "lapsed" ? " · ended" : ""}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardTitle>Profile</CardTitle>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {info.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-[var(--muted-foreground)]">{k}</dt>
                  <dd className="text-sm font-medium break-words">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardTitle hint={<span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Contents stay private</span>}>
              <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-brand-500" /> Documents</span>
            </CardTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(SERVICE_LABELS).map(([kind, label]) => (
                <div key={kind} className="rounded-xl bg-[var(--muted)] p-3">
                  <p className="text-xl font-bold tabular-nums">{docCounts.get(kind) ?? 0}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
                </div>
              ))}
              <div className="rounded-xl bg-brand-100 p-3 text-brand-900 dark:bg-brand-950 dark:text-brand-200">
                <p className="text-xl font-bold tabular-nums">{totalDocs}</p>
                <p className="text-xs">Total</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--muted-foreground)]">
              {customers.count ?? 0} saved customers · last document {lastDoc.data ? timeAgo(lastDoc.data.created_at) : "never"}. Documents hold the agent&apos;s customers&apos; personal data, so the portal shows counts only.
            </p>
          </Card>

          {can(admin, "payments.view") ? (
            <Card>
              <CardTitle>Plan payments</CardTitle>
              {(payments.data ?? []).length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No plan payments yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)] text-sm">
                  {((payments.data ?? []) as { id: string; plan_id: string; amount_inr: number; status: string; created_at: string }[]).map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2">
                      <span><span className="font-medium capitalize">{p.plan_id}</span> · {formatInr(p.amount_inr)} <span className="text-[var(--muted-foreground)]">· {formatDate(p.created_at)}</span></span>
                      <Badge tone={p.status === "approved" ? "green" : p.status === "pending" ? "amber" : p.status === "rejected" ? "red" : "neutral"} className="capitalize">{p.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          <Card>
            <CardTitle hint="Visible to admins only">Internal notes</CardTitle>
            <AgentNotes agentId={agent.id} canAdd={can(admin, "agents.notes")} notes={(notes.data ?? []) as { id: string; admin_name: string; body: string; created_at: string }[]} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Plan</CardTitle>
            <p className="text-2xl font-bold">{planName(sub.paidPlan ?? "silver")}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {sub.status === "free"
                ? "Free plan."
                : sub.status === "active"
                  ? `${sub.cycle === "monthly" ? "Monthly" : "Yearly"} · ends ${formatDate(sub.expiresAt)}${sub.daysLeft !== null ? ` (${sub.daysLeft} days)` : ""}`
                  : sub.status === "grace"
                    ? `Ended ${formatDate(sub.expiresAt)} · ${GRACE_DAYS[sub.paidPlan ?? "gold"][sub.cycle ?? "yearly"]}-day grace until ${formatDate(sub.graceEndsAt)}`
                    : `Ended ${formatDate(sub.expiresAt)} — now on Silver`}
            </p>
          </Card>

          <AgentActions
            agent={{
              id: agent.id,
              email: agent.email,
              name: display,
              status: agent.status,
              isVerified: agent.is_verified,
              reviewStatus: (agent as unknown as { verification_status?: string }).verification_status ?? null,
              plan: agent.subscription_plan,
              cycle: agent.subscription_cycle ?? null,
              expiresAt: agent.subscription_expires_at,
              features: { air_ticket: agent.air_ticketing_enabled, pickup_voucher: agent.travel_service_voucher_enabled, welcome_placard: agent.welcome_placard_enabled },
            }}
            perms={{
              review: can(admin, "agents.verify"),
              remind: can(admin, "agents.notes"),
              resetLink: can(admin, "agents.reset_link"),
              unlock: can(admin, "agents.unlock"),
              suspend: can(admin, "agents.suspend"),
              features: can(admin, "agents.features"),
              plan: can(admin, "agents.plan"),
              email: can(admin, "agents.email"),
              del: can(admin, "agents.delete"),
              exportData: can(admin, "agents.export"),
            }}
          />
        </div>
      </div>
    </>
  );
}
