import "server-only";
import { db } from "@/lib/db";
import type { Tone } from "@/components/ui";

/* Support centre for admins: tickets (incl. bug reports) and callback requests (migration 0010). */

export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type CallbackStatus = "requested" | "scheduled" | "completed" | "cancelled" | "missed";

export const TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting", "resolved", "closed"];
export const TICKET_PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];
export const CALLBACK_STATUSES: CallbackStatus[] = ["requested", "scheduled", "completed", "cancelled", "missed"];

export const TICKET_STATUS_META: Record<TicketStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "blue" },
  in_progress: { label: "In progress", tone: "amber" },
  waiting: { label: "Waiting on agent", tone: "brand" },
  resolved: { label: "Resolved", tone: "green" },
  closed: { label: "Closed", tone: "neutral" },
};
export const PRIORITY_META: Record<TicketPriority, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "blue" },
  high: { label: "High", tone: "amber" },
  urgent: { label: "Urgent", tone: "red" },
};
export const CALLBACK_STATUS_META: Record<CallbackStatus, { label: string; tone: Tone }> = {
  requested: { label: "Requested", tone: "amber" },
  scheduled: { label: "Scheduled", tone: "blue" },
  completed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  missed: { label: "Missed", tone: "red" },
};
export const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  documents: "Documents & PDFs",
  billing: "Plans & billing",
  account: "Account & profile",
  technical: "Technical",
  bug: "Bug report",
};
export const SLOT_LABELS: Record<string, string> = { morning: "Morning (10–1)", afternoon: "Afternoon (1–4)", evening: "Evening (4–7)" };

export interface TicketRow {
  id: string;
  number: number;
  agent_id: string;
  kind: "ticket" | "bug";
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  context: Record<string, string>;
  assigned_to: string | null;
  last_reply_from: "agent" | "support";
  last_reply_at: string;
  created_at: string;
}

export interface TicketMessageRow {
  id: string;
  from: "agent" | "support";
  author_name: string | null;
  body: string;
  attachment: string | null;
  created_at: string;
}

export interface CallbackRow {
  id: string;
  agent_id: string;
  phone: string;
  preferred_date: string;
  preferred_slot: string;
  topic: string;
  note: string | null;
  status: CallbackStatus;
  scheduled_at: string | null;
  admin_note: string | null;
  handled_by: string | null;
  created_at: string;
}

const TICKET_COLS = "id,number,agent_id,kind,subject,category,priority,status,context,assigned_to,last_reply_from,last_reply_at,created_at";

/** Tickets whose latest message is from the agent and that aren't resolved or closed. */
export async function ticketsNeedingReply(): Promise<number> {
  const { count } = await db()
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("last_reply_from", "agent")
    .in("status", ["open", "in_progress", "waiting"]);
  return count ?? 0;
}

export async function callbacksToHandle(): Promise<number> {
  const { count } = await db().from("callback_requests").select("id", { count: "exact", head: true }).eq("status", "requested");
  return count ?? 0;
}

export async function listTickets(filter: { statuses?: TicketStatus[]; kind?: "ticket" | "bug"; needsReply?: boolean }): Promise<TicketRow[]> {
  let q = db().from("support_tickets").select(TICKET_COLS);
  if (filter.statuses?.length) q = q.in("status", filter.statuses);
  if (filter.kind) q = q.eq("kind", filter.kind);
  if (filter.needsReply) q = q.eq("last_reply_from", "agent");
  const { data, error } = await q.order("last_reply_at", { ascending: !!filter.needsReply }).limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as TicketRow[];
}

export async function getTicket(id: string): Promise<{ ticket: TicketRow; messages: TicketMessageRow[] } | null> {
  const { data: ticket } = await db().from("support_tickets").select(TICKET_COLS).eq("id", id).maybeSingle();
  if (!ticket) return null;
  const { data: messages } = await db().from("support_ticket_messages").select("id,from,author_name,body,attachment,created_at").eq("ticket_id", id).order("created_at");
  return { ticket: ticket as TicketRow, messages: (messages ?? []) as TicketMessageRow[] };
}

export async function listCallbacks(statuses: CallbackStatus[]): Promise<CallbackRow[]> {
  const { data, error } = await db().from("callback_requests").select("*").in("status", statuses).order("preferred_date").order("created_at").limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as CallbackRow[];
}
