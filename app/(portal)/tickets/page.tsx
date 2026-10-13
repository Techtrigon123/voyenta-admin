import Link from "next/link";
import { Bug, Ticket } from "lucide-react";
import { requirePage } from "@/lib/auth/guard";
import { agentNames } from "@/lib/agents";
import { timeAgo } from "@/lib/utils";
import { CATEGORY_LABELS, PRIORITY_META, TICKET_STATUS_META, listTickets, type TicketStatus } from "@/lib/support";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { NavBar } from "@/components/ui/tubelight-navbar";

export const metadata = { title: "Support tickets" };

const TABS: { key: string; label: string; filter: Parameters<typeof listTickets>[0] }[] = [
  { key: "needs-reply", label: "Needs reply", filter: { statuses: ["open", "in_progress", "waiting"], needsReply: true } },
  { key: "open", label: "All open", filter: { statuses: ["open", "in_progress", "waiting"] } },
  { key: "resolved", label: "Resolved", filter: { statuses: ["resolved"] } },
  { key: "closed", label: "Closed", filter: { statuses: ["closed"] } },
  { key: "bugs", label: "Bug reports", filter: { kind: "bug" } },
  { key: "all", label: "Everything", filter: {} },
];

export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePage("support.reply");
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === requested) ?? TABS[0];

  let error = "";
  let tickets: Awaited<ReturnType<typeof listTickets>> = [];
  try {
    tickets = await listTickets(tab.filter);
  } catch (e) {
    error = (e as Error).message;
  }
  const names = await agentNames(tickets.map((t) => t.agent_id));

  return (
    <>
      <PageHeader
        title="Support tickets"
        description={tab.key === "needs-reply" ? `${tickets.length} ticket${tickets.length === 1 ? "" : "s"} waiting for our reply — oldest first.` : "Written requests and bug reports from agents."}
      />
      <NavBar className="mb-5" layoutId="ticket-tabs" items={TABS.map((t) => ({ name: t.label, url: `/tickets?tab=${t.key}` }))} active={tab.label} />

      {error ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">Could not load tickets: {error}. Has migration 0010 been run?</p>
      ) : tickets.length === 0 ? (
        <EmptyState icon={Ticket} title={tab.key === "needs-reply" ? "Nothing waiting" : "No tickets here"} text="Tickets and bug reports agents send from the Support menu appear here." />
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {tickets.map((t) => {
            const who = names.get(t.agent_id);
            const status = TICKET_STATUS_META[t.status as TicketStatus];
            const waiting = t.last_reply_from === "agent" && !["resolved", "closed"].includes(t.status);
            return (
              <li key={t.id}>
                <Link href={`/tickets/${t.id}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--muted)]">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.kind === "bug" ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"}`}>
                    {t.kind === "bug" ? <Bug className="h-4 w-4" /> : <Ticket className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">
                        <span className="text-[var(--muted-foreground)]">#{t.number}</span> {t.subject}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{timeAgo(t.last_reply_at)}</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                      {who?.company || who?.name || "Deleted agent"} · {CATEGORY_LABELS[t.category] ?? t.category}
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {t.priority !== "normal" ? <Badge tone={PRIORITY_META[t.priority].tone}>{PRIORITY_META[t.priority].label}</Badge> : null}
                      {waiting ? <Badge tone="amber">Needs reply</Badge> : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
