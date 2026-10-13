import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isUuid, requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { CATEGORY_LABELS, getTicket } from "@/lib/support";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import TicketPanel from "./TicketPanel";

export const metadata = { title: "Ticket" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePage("support.reply");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await getTicket(id).catch(() => null);
  if (!data) notFound();
  const { ticket, messages } = data;

  const [{ data: agent }, { data: assignee }] = await Promise.all([
    db().from("users").select("id,name,email,mobile,company_name").eq("id", ticket.agent_id).maybeSingle(),
    ticket.assigned_to ? db().from("admins").select("name").eq("id", ticket.assigned_to).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ctx = ticket.context ?? {};

  return (
    <>
      <PageHeader
        back="/tickets"
        title={`#${ticket.number} · ${ticket.subject}`}
        description={`${ticket.kind === "bug" ? "Bug report" : CATEGORY_LABELS[ticket.category] ?? ticket.category} · opened ${formatDate(ticket.created_at, true)}`}
        actions={
          agent && can(admin, "agents.view") ? (
            <Link href={`/agents/${agent.id}`} className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">
              View agent →
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <TicketPanel
          ticketId={ticket.id}
          initialMessages={messages}
          initialStatus={ticket.status}
          initialPriority={ticket.priority}
          assignedName={(assignee as { name?: string } | null)?.name ?? null}
          adminName={admin.name}
        />
        <aside className="space-y-4">
          <Card>
            <CardTitle>Agent</CardTitle>
            {agent ? (
              <dl className="space-y-1.5 text-sm">
                <div><dt className="text-xs text-[var(--muted-foreground)]">Name</dt><dd className="font-medium">{agent.company_name || agent.name}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Email</dt><dd className="break-all">{agent.email}</dd></div>
                {agent.mobile ? <div><dt className="text-xs text-[var(--muted-foreground)]">Phone</dt><dd>{agent.mobile}</dd></div> : null}
              </dl>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">This agent account was deleted.</p>
            )}
          </Card>
          {ticket.kind === "bug" ? (
            <Card>
              <CardTitle>Where it happened</CardTitle>
              <dl className="space-y-1.5 text-sm">
                <div><dt className="text-xs text-[var(--muted-foreground)]">Page</dt><dd className="break-all font-mono text-xs">{ctx.url || "—"}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Screen</dt><dd>{ctx.viewport || "—"}</dd></div>
                <div><dt className="text-xs text-[var(--muted-foreground)]">Browser</dt><dd className="break-all text-xs">{ctx.userAgent || "—"}</dd></div>
              </dl>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
