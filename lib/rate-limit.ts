import "server-only";
import { db } from "@/lib/db";

/**
 * Counts attempts in the shared rate_limits table (migration 0002). Fails closed: if the counter
 * can't be reached, the attempt is refused rather than let through unlimited.
 */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; resetIn: number }> {
  const { data, error } = await db().rpc("rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  const row = (data as { allowed: boolean; reset_at: string }[] | null)?.[0];
  if (error || !row) return { allowed: false, resetIn: windowSeconds };
  return { allowed: row.allowed, resetIn: Math.max(1, Math.ceil((new Date(row.reset_at).getTime() - Date.now()) / 1000)) };
}

export async function clearKey(key: string): Promise<void> {
  await db().from("rate_limits").delete().eq("key", key);
}
