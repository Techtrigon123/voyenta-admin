import "server-only";
import { db } from "@/lib/db";

/** Pending plan payments (awaiting a decision). */
export async function pendingPaymentCount(): Promise<number> {
  const { count } = await db().from("plan_payments").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}

/** Profiles waiting for this admin: masters see every open review, sub-admins only those to check. */
export async function openReviewCount(includeChecked: boolean): Promise<number> {
  const statuses = includeChecked ? ["pending", "checked", "changes_pending", "changes_checked"] : ["pending", "changes_pending"];
  const { count, error } = await db().from("users").select("id", { count: "exact", head: true }).in("verification_status", statuses);
  return error ? 0 : count ?? 0; // 0 until migration 0007 is run
}

/** Agents whose latest support message is from them — i.e. waiting for a reply. */
export async function unansweredSupport(): Promise<{ agentId: string; at: string; body: string }[]> {
  const { data } = await db()
    .from("support_messages")
    .select("agent_id,from,body,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  const seen = new Set<string>();
  const waiting: { agentId: string; at: string; body: string }[] = [];
  for (const m of (data ?? []) as { agent_id: string; from: string; body: string; created_at: string }[]) {
    if (seen.has(m.agent_id)) continue;
    seen.add(m.agent_id);
    if (m.from === "agent") waiting.push({ agentId: m.agent_id, at: m.created_at, body: m.body });
  }
  return waiting;
}
