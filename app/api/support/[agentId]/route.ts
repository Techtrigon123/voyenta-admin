import { db } from "@/lib/db";
import { isUuid, requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";

type Ctx = { params: Promise<{ agentId: string }> };

/** Reply to an agent's support chat. The reply appears in their Support page in the Vouchlio app. */
export async function POST(req: Request, { params }: Ctx) {
  const { admin, response } = await requireApi("support.reply");
  if (response) return response;
  const { agentId } = await params;
  if (!isUuid(agentId)) return fail("Agent not found.", 404);

  const body = String((await readJson(req)).body ?? "").trim();
  if (!body) return fail("Write a reply first.");
  if (body.length > 4000) return fail("Keep replies under 4,000 characters.");

  try {
    const { data: agent } = await db().from("users").select("id").eq("id", agentId).maybeSingle();
    if (!agent) return fail("Agent not found.", 404);
    const { data, error } = await db().from("support_messages").insert({ agent_id: agentId, from: "support", body }).select("id,from,body,created_at").single();
    if (error) throw new Error(error.message);
    await audit(admin, "support.reply", { type: "agent", id: agentId }, { length: body.length });
    return ok(data);
  } catch (error) {
    console.error("[POST /api/support/:agentId]", error);
    return fail("Could not send the reply. Please try again.", 500);
  }
}
