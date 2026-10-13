import "server-only";
import { db } from "@/lib/db";
import { DEFAULT_PRICES, type Prices } from "@/lib/plans";

/**
 * Site settings stored in app_settings and read by the Vouchlio app (checkin-app/lib/settings.ts).
 * Empty values mean "use the Vouchlio app's own default / environment variable".
 */
export interface PaymentSettings {
  upiId: string;
  payeeName: string;
  /** Razorpay checkout (also needs RAZORPAY_* keys in the Vouchlio app). */
  onlineEnabled: boolean;
  /** Pay by UPI QR and upload a proof for review. */
  manualUpi: boolean;
}

export interface AiSettings {
  enabled: boolean;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  userDailyCalls: number;
  freePoolDailyCalls: number;
}

/** Support channels shown to agents (read by checkin-app/lib/settings.ts). */
export interface SupportSettings {
  liveChat: boolean;
  tickets: boolean;
  bugReports: boolean;
  callbacks: boolean;
  callbackHours: string;
}

export interface Settings {
  payments: PaymentSettings;
  pricing: Prices;
  ai: AiSettings;
  support: SupportSettings;
}

/** Same defaults as the Vouchlio app's environment fallbacks. */
export const DEFAULT_SETTINGS: Settings = {
  payments: { upiId: "", payeeName: "", onlineEnabled: true, manualUpi: true },
  pricing: DEFAULT_PRICES,
  ai: { enabled: true, dailyBudgetUsd: 10, monthlyBudgetUsd: 150, userDailyCalls: 30, freePoolDailyCalls: 100 },
  support: { liveChat: true, tickets: true, bugReports: true, callbacks: true, callbackHours: "Mon–Sat, 10 am – 7 pm IST" },
};

export type SettingsKey = keyof Settings;

export async function getSettings(): Promise<Settings> {
  const { data } = await db().from("app_settings").select("key,value");
  const rows = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const merge = <K extends SettingsKey>(k: K): Settings[K] => {
    const v = rows.get(k);
    if (!v || typeof v !== "object") return DEFAULT_SETTINGS[k];
    if (k === "pricing") {
      const p = v as Partial<Prices>;
      return {
        gold: { ...DEFAULT_PRICES.gold, ...(p.gold ?? {}) },
        platinum: { ...DEFAULT_PRICES.platinum, ...(p.platinum ?? {}) },
      } as Settings[K];
    }
    return { ...DEFAULT_SETTINGS[k], ...(v as object) } as Settings[K];
  };
  return { payments: merge("payments"), pricing: merge("pricing"), ai: merge("ai"), support: merge("support") };
}

export async function saveSetting<K extends SettingsKey>(key: K, value: Settings[K], adminId: string): Promise<void> {
  const { error } = await db()
    .from("app_settings")
    .upsert({ key, value, updated_by: adminId, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Supabase: ${error.message}`);
}
