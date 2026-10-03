import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key (same project as the Voyenta app).
 * Never import this from a "use client" file — the key bypasses Row Level Security.
 */
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("lib/db must only be used on the server.");
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Throws on a Supabase error, otherwise returns the data. */
export function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

/** Whether a column added by a later migration exists yet (cached for a minute while missing). */
const columnCache = new Map<string, { present: boolean; at: number }>();
export async function hasColumn(table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  const hit = columnCache.get(key);
  if (hit && (hit.present || Date.now() - hit.at < 60_000)) return hit.present;
  const { error } = await db().from(table).select(column).limit(0);
  columnCache.set(key, { present: !error, at: Date.now() });
  return !error;
}
