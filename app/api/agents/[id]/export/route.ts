import { db } from "@/lib/db";
import { isUuid, requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Master only: everything stored for one agent as a JSON file (for data-access requests under the
 * DPDP Act, or account handover). Password hashes and reset tokens are never included.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { admin, response } = await requireApi("agents.export");
  if (response) return response;
  const { id } = await params;
  if (!isUuid(id)) return fail("Agent not found.", 404);

  const { data: user } = await db().from("users").select("*").eq("id", id).maybeSingle();
  if (!user) return fail("Agent not found.", 404);
  const { password_hash: _ph, reset_token: _rt, reset_token_expiry: _re, ...profile } = user as Record<string, unknown>;
  void _ph;
  void _rt;
  void _re;

  const [documents, customers, payments, support] = await Promise.all([
    db().from("agent_documents").select("*").eq("agent_id", id).order("created_at"),
    db().from("customers").select("*").eq("agent_id", id).order("created_at"),
    db().from("plan_payments").select("id,plan_id,amount_inr,payment_transaction_id,status,created_at,updated_at").eq("agent_id", id).order("created_at"),
    db().from("support_messages").select("from,body,created_at").eq("agent_id", id).order("created_at"),
  ]);

  await audit(admin, "agent.export", { type: "agent", id }, { documents: documents.data?.length ?? 0 });

  const file = {
    exportedAt: new Date().toISOString(),
    exportedBy: admin.email,
    profile,
    documents: documents.data ?? [],
    customers: customers.data ?? [],
    planPayments: payments.data ?? [],
    supportMessages: support.data ?? [],
  };
  const safeName = String(profile.email ?? id).replace(/[^a-z0-9._-]+/gi, "_");
  return new Response(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="voyenta-agent-${safeName}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
