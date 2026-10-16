import "server-only";

/**
 * In-memory cache for expensive reads that are the same for every admin (report aggregates).
 * Each server instance keeps its own copy for `ttlMs`, and callers arriving while a load is running
 * share it. A load that throws, or whose result fails `keep`, isn't reused.
 * Never cache sessions, permissions or anything one admin must see changed immediately.
 */
const entries = new Map<string, { at: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, keep: (value: T) => boolean = () => true): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  entries.set(key, { at: Date.now(), value });
  const forget = () => {
    if (entries.get(key)?.value === value) entries.delete(key);
  };
  value.then((v) => !keep(v) && forget(), forget);
  return value;
}
