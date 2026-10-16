import { requireApi } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { fail, ok, readJson } from "@/lib/http";
import { getSettings, saveSetting, type AiSettings, type PaymentSettings, type SupportSettings } from "@/lib/settings";
import type { Prices } from "@/lib/plans";

const money = (v: unknown, max: number): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : null;
};

/** Master only. Body: { key: "payments" | "pricing" | "ai" | "support", value } */
export async function POST(req: Request) {
  const { admin, response } = await requireApi("settings.manage");
  if (response) return response;
  const body = await readJson(req);
  const key = String(body.key ?? "");
  const v = (body.value ?? {}) as Record<string, unknown>;

  try {
    const before = await getSettings();

    if (key === "payments") {
      const upiId = String(v.upiId ?? "").trim();
      const payeeName = String(v.payeeName ?? "").trim().slice(0, 80);
      if (upiId && !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) return fail("Enter a valid UPI ID, like yourname@bank.");
      const onlineEnabled = v.onlineEnabled !== false;
      const manualUpi = v.manualUpi !== false;
      if (!onlineEnabled && !manualUpi) return fail("Keep at least one way to pay switched on, or agents can't upgrade.");
      const value: PaymentSettings = { upiId, payeeName, onlineEnabled, manualUpi };
      await saveSetting("payments", value, admin.id);
      await audit(admin, "settings.payments", { type: "settings", id: "payments" }, { before: before.payments, after: value });
      return ok(true, "Payment details saved. Checkout uses them right away.");
    }

    if (key === "pricing") {
      const read = (plan: "gold" | "platinum", cycle: "monthly" | "yearly") => {
        const n = Number((v as Record<string, Record<string, unknown>>)[plan]?.[cycle]);
        return Number.isInteger(n) && n >= 1 && n <= 1_000_000 ? n : null;
      };
      const value = {
        gold: { monthly: read("gold", "monthly"), yearly: read("gold", "yearly") },
        platinum: { monthly: read("platinum", "monthly"), yearly: read("platinum", "yearly") },
      };
      if (Object.values(value).some((p) => p.monthly === null || p.yearly === null)) return fail("Prices must be whole rupee amounts between ₹1 and ₹10,00,000.");
      if (value.gold.monthly! >= value.platinum.monthly! || value.gold.yearly! >= value.platinum.yearly!) return fail("Platinum should cost more than Gold.");
      await saveSetting("pricing", value as Prices, admin.id);
      await audit(admin, "settings.pricing", { type: "settings", id: "pricing" }, { before: before.pricing, after: value });
      return ok(true, "Prices saved. New checkouts use them; plans already paid for keep their price.");
    }

    if (key === "ai") {
      const value: AiSettings = {
        enabled: v.enabled !== false,
        dailyBudgetUsd: money(v.dailyBudgetUsd, 10_000) ?? -1,
        monthlyBudgetUsd: money(v.monthlyBudgetUsd, 100_000) ?? -1,
        userDailyCalls: money(v.userDailyCalls, 10_000) ?? -1,
        freePoolDailyCalls: money(v.freePoolDailyCalls, 100_000) ?? -1,
      };
      if (Object.values(value).some((x) => x === -1)) return fail("Enter numbers of zero or more for every limit.");
      if (value.monthlyBudgetUsd < value.dailyBudgetUsd) return fail("The monthly budget can't be lower than the daily budget.");
      value.userDailyCalls = Math.floor(value.userDailyCalls);
      value.freePoolDailyCalls = Math.floor(value.freePoolDailyCalls);
      await saveSetting("ai", value, admin.id);
      await audit(admin, "settings.ai", { type: "settings", id: "ai" }, { before: before.ai, after: value });
      return ok(true, value.enabled ? "AI limits saved." : "Upload auto-fill switched off for everyone.");
    }

    if (key === "support") {
      const value: SupportSettings = {
        tickets: v.tickets !== false,
        bugReports: v.bugReports !== false,
        callbacks: v.callbacks !== false,
        callbackHours: String(v.callbackHours ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
      };
      if (!value.callbackHours) return fail("Enter the hours you take callback calls, e.g. Mon–Sat, 10 am – 7 pm IST.");
      await saveSetting("support", value, admin.id);
      await audit(admin, "settings.support", { type: "settings", id: "support" }, { before: before.support, after: value });
      return ok(true, "Support options saved. Agents see the change within a minute.");
    }

    return fail("Unknown setting.");
  } catch (error) {
    console.error("[POST /api/settings]", error);
    return fail("Could not save the settings. Please try again.", 500);
  }
}
