import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { isUuid, requirePage } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import Thread from "./Thread";

export const metadata = { title: "Support chat" };

export default async function SupportThreadPage({ params }: { params: Promise<{ agentId: string }> }) {
  const admin = await requirePage("support.reply");
  const { agentId } = await params;
  if (!isUuid(agentId)) notFound();
  const [{ data: agent }, { data: messages }] = await Promise.all([
    db().from("users").select("id,name,email,company_name,mobile").eq("id", agentId).maybeSingle(),
    db().from("support_messages").select("id,from,body,created_at").eq("agent_id", agentId).order("created_at").limit(500),
  ]);
  if (!agent) notFound();

  return (
    <>
      <Link href="/support" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> All chats
      </Link>
      <PageHeader
        title={agent.company_name || agent.name}
        description={`${agent.name} · ${agent.email}${agent.mobile ? ` · ${agent.mobile}` : ""}`}
        actions={can(admin, "agents.view") ? <Link href={`/agents/${agent.id}`} className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-300">View agent →</Link> : undefined}
      />
      <Thread agentId={agent.id} initial={(messages ?? []) as { id: string; from: "agent" | "support"; body: string; created_at: string }[]} />
    </>
  );
}
