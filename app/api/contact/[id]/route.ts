import { db } from "@/lib/db";
import { isUuid, requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Set a contact-form message's status: new → replied → closed. */
export async function POST(req: Request, { params }: Ctx) {
  const { admin, response } = await requireApi("contact.manage");
  if (response) return response;
  const { id } = await params;
  if (!isUuid(id)) return fail("Message not found.", 404);
  const status = String((await readJson(req)).status ?? "");
  if (!["new", "replied", "closed"].includes(status)) return fail("Unknown status.");
  const { data, error } = await db().from("contact_messages").update({ status }).eq("id", id).select("id").maybeSingle();
  if (error) return fail("Could not update the message.", 500);
  if (!data) return fail("Message not found.", 404);
  await audit(admin, "contact.status", { type: "contact", id }, { status });
  return ok(true, status === "closed" ? "Closed." : status === "replied" ? "Marked as replied." : "Reopened.");
}
