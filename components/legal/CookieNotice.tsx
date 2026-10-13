"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

/**
 * One-time notice: the portal uses only essential storage, so this informs rather than asks.
 * Hidden on the server and until the browser says it hasn't been dismissed (no layout flash).
 */
const KEY = "vouchlio-admin-cookie-notice";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // storage blocked: don't nag on every page
  }
}

function dismiss() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export default function CookieNotice() {
  const dismissed = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => true // server: render nothing
  );
  if (dismissed) return null;

  return (
    <div role="region" aria-label="Cookie notice" className="anim-rise fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-2xl sm:bottom-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <Cookie className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Essential cookies only</p>
          <p className="mt-0.5 text-[var(--muted-foreground)]">
            We use one cookie to keep you signed in and save a few settings in your browser. No tracking or analytics.{" "}
            <Link href="/cookies" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">Cookie Policy</Link>
          </p>
          <button type="button" onClick={dismiss} className="btn-glow mt-3 inline-flex h-9 items-center rounded-lg px-4 text-sm">
            Got it
          </button>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss cookie notice" className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
