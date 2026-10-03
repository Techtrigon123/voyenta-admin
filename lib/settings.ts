import "server-only";
import { db } from "@/lib/db";
import { DEFAULT_PRICES, type Prices } from "@/lib/plans";

/**
 * Site settings stored in app_settings and read by the Voyenta app (checkin-app/lib/settings.ts).
 * Empty values mean "use the Voyenta app's own default / environment variable".
 */
export interface PaymentSettings {
  upiId: string;
  payeeName: string;
}

export interface AiSettings {
  enabled: boolean;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  userDailyCalls: number;
  freePoolDailyCalls: number;
}

export interface Settings {
  payments: PaymentSettings;
  pricing: Prices;
  ai: AiSettings;
}

/** Same defaults as the Voyenta app's environment fallbacks. */
export const DEFAULT_SETTINGS: Settings = {
  payments: { upiId: "", payeeName: "" },
  pricing: DEFAULT_PRICES,
  ai: { enabled: true, dailyBudgetUsd: 10, monthlyBudgetUsd: 150, userDailyCalls: 30, freePoolDailyCalls: 100 },
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
  return { payments: merge("payments"), pricing: merge("pricing"), ai: merge("ai") };
}

export async function saveSetting<K extends SettingsKey>(key: K, value: Settings[K], adminId: string): Promise<void> {
  const { error } = await db()
    .from("app_settings")
    .upsert({ key, value, updated_by: adminId, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`Supabase: ${error.message}`);
}
