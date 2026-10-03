/** Presentational pieces — no hooks, safe in Server and Client Components. The dialog lives in components/modal.tsx. */
import React from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const primaryBtn =
  "btn-glow inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-brand-300 hover:bg-brand-50/60 dark:hover:bg-brand-950/40 disabled:cursor-not-allowed disabled:opacity-50";
export const dangerBtn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50";
export const inputCls =
  "h-10 w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5", className)}>{children}</section>;
}

export function CardTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold">{children}</h2>
      {hint ? <span className="text-xs text-[var(--muted-foreground)]">{hint}</span> : null}
    </div>
  );
}

const TONES = {
  neutral: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  brand: "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  blue: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", TONES[tone], className)}>{children}</span>;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "brand" }: { label: string; value: React.ReactNode; hint?: string; icon: LucideIcon; tone?: "brand" | "amber" | "green" | "red" }) {
  const ring = { brand: "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300", amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", red: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" }[tone];
  return (
    <div className="anim-rise rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", ring)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      {text ? <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{text}</p> : null}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-[var(--muted-foreground)]">{hint}</p> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

/** Table shell with the console's styling. */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">{children}</tbody>
      </table>
    </div>
  );
}
