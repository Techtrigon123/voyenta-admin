import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth/guard";
import { formatDate } from "@/lib/utils";
import { Badge, EmptyState, PageHeader, inputCls, secondaryBtn, type Tone } from "@/components/ui";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

const GROUPS = [
  { key: "", label: "All actions" },
  { key: "login", label: "Sign-ins" },
  { key: "payment", label: "Payments" },
  { key: "agent", label: "Agents" },
  { key: "support", label: "Support" },
  { key: "admin", label: "Admins" },
  { key: "settings", label: "Settings" },
];

function tone(action: string): Tone {
  if (action === "login.failed" || /delete|suspend|reject|refund|disable/.test(action)) return "red";
  if (/approve|verify|enable|login.success/.test(action)) return "green";
  if (/plan|email|permissions|reset|settings/.test(action)) return "amber";
  return "neutral";
}

type Search = { group?: string; target?: string; page?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePage("audit.view");
  const sp = await searchParams;
  const group = GROUPS.find((g) => g.key === sp.group)?.key ?? "";
  const target = (sp.target ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36);
  const page = Math.max(1, Number(sp.page) || 1);

  let q = db().from("admin_audit_log").select("id,admin_email,action,target_type,target_id,details,ip,created_at", { count: "exact" });
  if (group) q = q.like("action", `${group}.%`);
  if (target) q = q.eq("target_id", target);
  const { data, count, error } = await q.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as { id: number; admin_email: string | null; action: string; target_type: string | null; target_id: string | null; details: Record<string, unknown>; ip: string | null; created_at: string }[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, String(v));
    return `/audit?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="Audit log" description="Every admin action, newest first. Entries can't be edited or deleted — by anyone." />
      <form className="mb-5 grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:grid-cols-[auto_1fr_auto]">
        <select name="group" defaultValue={group} className={inputCls} aria-label="Action type">
          {GROUPS.map((g) => (
            <option key={g.key} value={g.key}>{g.label}</option>
          ))}
        </select>
        <input name="target" defaultValue={target} placeholder="Agent / admin / payment ID (optional)" className={inputCls} />
        <button type="submit" className={secondaryBtn}>Filter</button>
      </form>

      {error ? (
        <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">Could not load the audit log: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No entries" />
      ) : (
        <>
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
            {rows.map((r) => {
              const details = Object.entries(r.details ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "");
              return (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={tone(r.action)} className="font-mono">{r.action}</Badge>
                    <span className="font-medium">{r.admin_email ?? "unknown"}</span>
                    {r.target_type && r.target_id ? (
                      r.target_type === "agent" ? (
                        <Link href={`/agents/${r.target_id}`} className="text-xs text-brand-600 hover:underline dark:text-brand-300">agent {r.target_id.slice(0, 8)}</Link>
                      ) : (
                        <Link href={link({ target: r.target_id, page: undefined })} className="text-xs text-[var(--muted-foreground)] hover:underline">{r.target_type} {r.target_id.slice(0, 8)}</Link>
                      )
                    ) : null}
                    <span className="ml-auto text-xs text-[var(--muted-foreground)]">{formatDate(r.created_at, true)}{r.ip ? ` · ${r.ip}` : ""}</span>
                  </div>
                  {details.length ? (
                    <p className="mt-1.5 break-words font-mono text-[11px] text-[var(--muted-foreground)]">
                      {details.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-[var(--muted-foreground)]">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link href={link({ page: String(page - 1) })} className={secondaryBtn}><ChevronLeft className="h-4 w-4" /> Newer</Link> : null}
              {page < pages ? <Link href={link({ page: String(page + 1) })} className={secondaryBtn}>Older <ChevronRight className="h-4 w-4" /></Link> : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
