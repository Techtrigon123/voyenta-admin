import { PhoneCall } from "lucide-react";
import { requirePage } from "@/lib/auth/guard";
import { agentNames } from "@/lib/agents";
import { listCallbacks, type CallbackStatus } from "@/lib/support";
import { EmptyState, PageHeader } from "@/components/ui";
import { NavBar } from "@/components/ui/tubelight-navbar";
import CallbackList from "./CallbackList";

export const metadata = { title: "Callback requests" };

const TABS: { key: string; label: string; statuses: CallbackStatus[] }[] = [
  { key: "requested", label: "To handle", statuses: ["requested"] },
  { key: "scheduled", label: "Scheduled", statuses: ["scheduled"] },
  { key: "done", label: "Done", statuses: ["completed", "missed", "cancelled"] },
];

export default async function CallbacksPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePage("support.reply");
  const requested = (await searchParams).tab;
  const tab = TABS.find((t) => t.key === requested) ?? TABS[0];

  let error = "";
  let rows: Awaited<ReturnType<typeof listCallbacks>> = [];
  try {
    rows = await listCallbacks(tab.statuses);
  } catch (e) {
    error = (e as Error).message;
  }
  const names = await agentNames(rows.map((r) => r.agent_id));
  const items = rows.map((r) => {
    const who = names.get(r.agent_id);
    return { ...r, agentName: who?.company || who?.name || "Deleted agent", agentEmail: who?.email ?? "" };
  });

  return (
    <>
      <PageHeader title="Callback requests" description="Agents who asked us to call them. Schedule a time, then mark the call done." />
      <NavBar className="mb-5" layoutId="callback-tabs" items={TABS.map((t) => ({ name: t.label, url: `/callbacks?tab=${t.key}` }))} active={tab.label} />
      {error ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">Could not load callbacks: {error}. Has migration 0010 been run?</p>
      ) : items.length === 0 ? (
        <EmptyState icon={PhoneCall} title="Nothing here" text="Callback requests from the Support menu appear here." />
      ) : (
        <CallbackList items={items} />
      )}
    </>
  );
}
