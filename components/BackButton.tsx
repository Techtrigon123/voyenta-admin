"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Counts client-side page changes in this tab, so the back button knows whether "back" stays
 * inside the app. document.referrer can't tell us: it never changes during client navigation.
 */
let inAppNavigations = 0;

/** Mount once in the root layout. Renders nothing. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    inAppNavigations += 1;
  }, [pathname]);
  return null;
}

function canGoBackInApp(): boolean {
  if (inAppNavigations > 1) return true; // the first count is the page this tab opened on
  try {
    return !!document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1;
  } catch {
    return false;
  }
}

/**
 * Round "back" button. Goes to the previous page when it was a page of this app (keeping its
 * filters and scroll position); otherwise — opened from a bookmark, an email or another site —
 * it goes to `fallback` instead of leaving the app.
 */
export function BackButton({ fallback, label = "Go back", className }: { fallback: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (canGoBackInApp() ? router.back() : router.push(fallback))}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] shadow-sm transition",
        "hover:-translate-x-0.5 hover:border-brand-400 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
        "dark:hover:border-brand-neon/50 dark:hover:text-brand-neon motion-reduce:hover:translate-x-0",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

export default BackButton;
