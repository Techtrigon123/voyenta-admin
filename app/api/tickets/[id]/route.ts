import { db } from "@/lib/db";
import { isUuid, requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import { TICKET_PRIORITIES, TICKET_STATUSES, type TicketPriority, type TicketStatus } from "@/lib/support";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Work a support ticket. Body: { action, ... }
 * - reply:    { body, resolve? }  adds a support reply; status → waiting (or resolved)
 * - status:   { status }
 * - priority: { priority }
 * - assign:   { to: "me" | "none" }
 */
export async function POST(req: Request, { params }: Ctx) {
  const { admin, response } = await requireApi("support.reply");
  if (response) return response;
  const { id } = await params;
  if (!isUuid(id)) return fail("Ticket not found.", 404);
  const b = await readJson(req);
  const action = String(b.action ?? "");

  try {
    const { data: ticket } = await db().from("support_tickets").select("id,number,status,priority,assigned_to").eq("id", id).maybeSingle();
    if (!ticket) return fail("Ticket not found.", 404);
    const target = { type: "ticket", id };

    if (action === "reply") {
      const body = String(b.body ?? "").trim();
      if (!body) return fail("Write a reply first.");
      if (body.length > 5000) return fail("Keep replies under 5,000 characters.");
      if (ticket.status === "closed") return fail("This ticket is closed. Reopen it first if you need to reply.", 409);
      const { data: msg, error } = await db()
        .from("support_ticket_messages")
        .insert({ ticket_id: id, from: "support", author_name: admin.name, body })
        .select("id,from,author_name,body,attachment,created_at")
        .single();
      if (error) throw new Error(error.message);
      const status: TicketStatus = b.resolve === true ? "resolved" : "waiting";
      await db()
        .from("support_tickets")
        .update({ last_reply_from: "support", last_reply_at: new Date().toISOString(), status, assigned_to: ticket.assigned_to ?? admin.id })
        .eq("id", id);
      await audit(admin, "ticket.reply", target, { number: ticket.number, length: body.length, status });
      return ok({ message: msg, status });
    }

    if (action === "status") {
      const status = String(b.status) as TicketStatus;
      if (!TICKET_STATUSES.includes(status)) return fail("Unknown status.");
      await db().from("support_tickets").update({ status }).eq("id", id);
      await audit(admin, "ticket.status", target, { number: ticket.number, before: ticket.status, after: status });
      return ok({ status }, "Status updated.");
    }

    if (action === "priority") {
      const priority = String(b.priority) as TicketPriority;
      if (!TICKET_PRIORITIES.includes(priority)) return fail("Unknown priority.");
      await db().from("support_tickets").update({ priority }).eq("id", id);
      await audit(admin, "ticket.priority", target, { number: ticket.number, before: ticket.priority, after: priority });
      return ok({ priority }, "Priority updated.");
    }

    if (action === "assign") {
      const to = b.to === "me" ? admin.id : null;
      await db().from("support_tickets").update({ assigned_to: to }).eq("id", id);
      await audit(admin, "ticket.assign", target, { number: ticket.number, to: to ? admin.email : null });
      return ok({ assignedTo: to }, to ? "Assigned to you." : "Unassigned.");
    }

    return fail("Unknown action.");
  } catch (error) {
    console.error("[POST /api/tickets/:id]", error);
    return fail("Could not update the ticket. Please try again.", 500);
  }
}
