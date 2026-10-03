import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { agentNames } from "@/lib/agents";
import { timeAgo } from "@/lib/utils";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Support chats" };

export default async function SupportPage() {
  await requirePage("support.reply");
  const { data } = await db().from("support_messages").select("agent_id,from,body,created_at").order("created_at", { ascending: false }).limit(2000);

  // One row per agent: their latest message, and whether it's waiting for us.
  const threads = new Map<string, { agentId: string; last: string; at: string; waiting: boolean; count: number }>();
  for (const m of (data ?? []) as { agent_id: string; from: string; body: string; created_at: string }[]) {
    const t = threads.get(m.agent_id);
    if (t) t.count += 1;
    else threads.set(m.agent_id, { agentId: m.agent_id, last: m.body, at: m.created_at, waiting: m.from === "agent", count: 1 });
  }
  const list = [...threads.values()].sort((a, b) => Number(b.waiting) - Number(a.waiting) || b.at.localeCompare(a.at));
  const names = await agentNames(list.map((t) => t.agentId));
  const waiting = list.filter((t) => t.waiting).length;

  return (
    <>
      <PageHeader title="Support chats" description={waiting ? `${waiting} agent${waiting === 1 ? " is" : "s are"} waiting for a reply.` : "Every agent has an answer."} />
      {list.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No support chats yet" text="When agents write from the Support page in Voyenta, their messages land here." />
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          {list.map((t) => {
            const who = names.get(t.agentId);
            return (
              <li key={t.agentId}>
                <Link href={`/support/${t.agentId}`} className="flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--muted)]">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-brand-neon">
                    {(who?.company || who?.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{who?.company || who?.name || "Deleted agent"}</span>
                      <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{timeAgo(t.at)}</span>
                    </span>
                    <span className="line-clamp-1 text-sm text-[var(--muted-foreground)]">{t.last}</span>
                  </span>
                  {t.waiting ? <Badge tone="amber">Waiting</Badge> : <Badge tone="green">Replied</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
