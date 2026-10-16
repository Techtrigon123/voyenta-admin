import { createHash, randomBytes } from "crypto";
import { db, hasColumn } from "@/lib/db";
import { isUuid, requireApi } from "@/lib/auth/guard";
import { getAgent } from "@/lib/agents";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import type { Permission } from "@/lib/permissions";
import { hit, retryMessage } from "@/lib/rate-limit";
import { GRACE_DAYS, planName, subscriptionState } from "@/lib/plans";

type Ctx = { params: Promise<{ id: string }> };

const PERMISSION: Record<string, Permission> = {
  note: "agents.notes",
  // Sends a renewal / upgrade reminder to the agent's bell — any admin who can add notes may send one.
  plan_reminder: "agents.notes",
  reset_link: "agents.reset_link",
  unlock: "agents.unlock",
  suspend: "agents.suspend",
  features: "agents.features",
  plan: "agents.plan",
  email: "agents.email",
  delete: "agents.delete",
};

/**
 * Daily ceilings per admin for the riskiest actions, on top of the proxy's limits (which can't
 * see the action in the body). A real working day stays well under these; a stolen session or a
 * mistake in a loop can't take over, delete or re-email agents in bulk.
 */
const ACTION_DAILY_LIMIT: Partial<Record<string, number>> = {
  reset_link: 30,
  unlock: 50,
  suspend: 30,
  plan: 50,
  plan_reminder: 50,
  email: 20,
  delete: 10,
};

const RESET_TTL_MS = 60 * 60 * 1000; // same 1 hour as the Vouchlio app's own reset links

/** Every change to an agent goes through here: one permission per action, every change audited. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson(req);
  const action = String(body.action ?? "");
  const permission = PERMISSION[action];
  if (!permission) return fail("Unknown action.");

  const { admin, response } = await requireApi(permission);
  if (response) return response;
  if (!isUuid(id)) return fail("Agent not found.", 404);

  const cap = ACTION_DAILY_LIMIT[action];
  if (cap) {
    const limit = await hit(`admin:day:agent-${action}:${admin.id}`, cap, 24 * 60 * 60);
    if (!limit.allowed) return fail(retryMessage(limit.resetIn), 429, "RATE_LIMITED");
  }

  try {
    const agent = await getAgent(id);
    if (!agent) return fail("Agent not found.", 404);
    const target = { type: "agent", id: agent.id };
    const users = () => db().from("users");

    switch (action) {
      case "plan_reminder": {
        const s = subscriptionState(agent);
        const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
        const name = planName(s.paidPlan);
        let note: { title: string; body: string; href: string };
        if ((s.status === "active" || s.status === "grace") && s.expiresAt && s.graceEndsAt && s.cycle) {
          const href = `/dashboard/pricing?plan=${s.paidPlan}&cycle=${s.cycle}`;
          note =
            s.status === "active"
              ? { title: `Reminder: renew your ${name} plan`, body: `Your ${name} plan ends on ${day(s.expiresAt)}. Renew before then to keep your features without a break — you also get ${GRACE_DAYS[s.cycle]} days of grace after it ends.`, href }
              : { title: `Renew ${name} before ${day(s.graceEndsAt)}`, body: `Your ${name} plan has ended and you're in the grace period. Renew before ${day(s.graceEndsAt)}, or your account moves to the free Silver plan.`, href };
        } else if (s.status === "active") {
          return fail("This plan has no end date, so there's nothing to renew yet.");
        } else if (s.status === "lapsed" && s.paidPlan) {
          note = { title: `Your ${name} plan has ended`, body: `Renew ${name} to unlock your documents and services again — your saved work is waiting.`, href: `/dashboard/pricing?plan=${s.paidPlan}${s.cycle ? `&cycle=${s.cycle}` : ""}` };
        } else {
          note = { title: "Unlock more with Gold or Platinum", body: "Upgrade for unlimited documents with your logo and no watermark, plus proforma invoices, air tickets, itineraries and more.", href: "/dashboard/pricing" };
        }
        const { error } = await db().from("agent_notifications").insert({ agent_id: agent.id, kind: "plan", ...note });
        if (error) {
          if (/agent_notifications/.test(error.message)) return fail("Run migration 0013_agent_notifications.sql in Supabase first.", 500, "MIGRATION_MISSING");
          throw new Error(error.message);
        }
        await audit(admin, "agent.plan_reminder", target, { status: s.status, plan: s.paidPlan ?? "silver" });
        return ok(true, "Reminder sent — it appears in the agent's notification bell.");
      }

      case "note": {
        const text = String(body.body ?? "").trim();
        if (!text) return fail("Write a note first.");
        if (text.length > 2000) return fail("Keep notes under 2,000 characters.");
        const { error } = await db().from("agent_notes").insert({ agent_id: agent.id, admin_id: admin.id, admin_name: admin.name, body: text });
        if (error) throw new Error(error.message);
        await audit(admin, "agent.note", target, { length: text.length });
        return ok(true, "Note added.");
      }

      case "reset_link": {
        if (agent.status === "SUSPENDED") return fail("This account is suspended. Reactivate it before sending a reset link.");
        const token = randomBytes(32).toString("base64url");
        await users()
          .update({ reset_token: createHash("sha256").update(token).digest("hex"), reset_token_expiry: new Date(Date.now() + RESET_TTL_MS).toISOString() })
          .eq("id", agent.id);
        const base = (process.env.AGENT_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
        await audit(admin, "agent.reset_link", target);
        return ok({ link: `${base}/reset-password/${token}`, expiresInMinutes: RESET_TTL_MS / 60_000 }, "Reset link created.");
      }

      case "unlock": {
        // Login / reset counters for this email, and per-account counters for this user.
        // Matched exactly in code, not with a LIKE pattern built from the email: "_" and "%" are LIKE
        // wildcards, so john_doe@… would also have cleared the counters of johnxdoe@….
        const emailSuffix = `email:${agent.email.trim().toLowerCase()}`;
        const userSuffix = `user:${agent.id}`;
        const { data: candidates } = await db().from("rate_limits").select("key").or("key.like.*email:*,key.like.*user:*").limit(5000);
        const keys = ((candidates ?? []) as { key: string }[]).map((r) => r.key).filter((k) => k.endsWith(emailSuffix) || k.endsWith(userSuffix));
        const { data } = keys.length ? await db().from("rate_limits").delete().in("key", keys).select("key") : { data: [] };
        await audit(admin, "agent.unlock", target, { cleared: (data ?? []).length });
        return ok({ cleared: (data ?? []).length }, (data ?? []).length ? "Account unlocked." : "Nothing was locked.");
      }

      case "suspend": {
        const suspend = body.suspended === true;
        // Reactivated accounts start as Inactive; the Vouchlio app makes them Active again on their next activity.
        const status = suspend ? "SUSPENDED" : "INACTIVE";
        await users().update({ status }).eq("id", agent.id);
        await audit(admin, suspend ? "agent.suspend" : "agent.reactivate", target, { before: agent.status, after: status, reason: String(body.reason ?? "").slice(0, 300) || undefined });
        return ok(true, suspend ? "Account suspended — the agent is signed out of the app." : "Account reactivated.");
      }

      case "features": {
        const patch = {
          air_ticketing_enabled: body.air_ticket !== false,
          travel_service_voucher_enabled: body.pickup_voucher !== false,
          welcome_placard_enabled: body.welcome_placard !== false,
        };
        const before = { air_ticketing_enabled: agent.air_ticketing_enabled, travel_service_voucher_enabled: agent.travel_service_voucher_enabled, welcome_placard_enabled: agent.welcome_placard_enabled };
        await users().update(patch).eq("id", agent.id);
        await audit(admin, "agent.features", target, { before, after: patch });
        return ok(true, "Services updated.");
      }

      case "plan": {
        const plan = String(body.plan ?? "");
        if (!["silver", "gold", "platinum"].includes(plan)) return fail("Choose Silver, Gold or Platinum.");
        const cycle = body.cycle === "monthly" ? "monthly" : "yearly";
        let expiresAt: string | null = null;
        if (plan !== "silver") {
          const d = new Date(String(body.expiresAt ?? ""));
          if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) return fail("Choose an end date in the future.");
          expiresAt = d.toISOString();
        }
        const patch: Record<string, unknown> = { subscription_plan: plan, subscription_expires_at: expiresAt };
        if (await hasColumn("users", "subscription_cycle")) patch.subscription_cycle = plan === "silver" ? null : cycle;
        const reason = String(body.reason ?? "").trim().slice(0, 300);
        if (!reason) return fail("Add a reason (for example “Complimentary month for launch partner”).");
        await users().update(patch).eq("id", agent.id);
        await audit(admin, "agent.plan_change", target, {
          before: { plan: agent.subscription_plan, expiresAt: agent.subscription_expires_at, cycle: agent.subscription_cycle ?? null },
          after: { plan, expiresAt, cycle: plan === "silver" ? null : cycle },
          reason,
        });
        return ok(true, "Plan updated.");
      }

      case "email": {
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return fail("Enter a valid email address.");
        if (email === agent.email) return fail("That's already the agent's email.");
        const { data: taken } = await users().select("id").eq("email", email).maybeSingle();
        if (taken) return fail("Another account already uses this email.", 409);
        // Clear any reset link sent to the old address.
        await users().update({ email, reset_token: null, reset_token_expiry: null }).eq("id", agent.id);
        await audit(admin, "agent.email_change", target, { before: agent.email, after: email });
        return ok(true, "Email changed. The agent signs in with the new address from now on.");
      }

      case "delete": {
        if (String(body.confirmEmail ?? "").trim().toLowerCase() !== agent.email) return fail("Type the agent's email exactly to confirm.");
        const { count } = await db().from("agent_documents").select("id", { count: "exact", head: true }).eq("agent_id", agent.id);
        // Log first: the audit entry must exist even though the agent row is about to disappear.
        await audit(admin, "agent.delete", target, { email: agent.email, name: agent.name, company: agent.company_name, documents: count ?? 0, reason: String(body.reason ?? "").slice(0, 300) || undefined });
        const { error } = await users().delete().eq("id", agent.id);
        if (error) throw new Error(error.message);
        return ok(true, "Agent account and all its data deleted.");
      }
    }
    return fail("Unknown action.");
  } catch (error) {
    console.error("[POST /api/agents/:id]", action, error);
    return fail("Could not save this change. Please try again.", 500);
  }
}
