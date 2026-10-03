"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, ShieldCheck, ShieldOff, Smartphone, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { PERMISSIONS, SUB_DEFAULT, SUB_GRANTABLE, type Permission } from "@/lib/permissions";
import { timeAgo } from "@/lib/utils";
import { Badge, Field, Spinner, inputCls, primaryBtn, secondaryBtn } from "@/components/ui";
import { Modal } from "@/components/modal";

export interface AdminItem {
  id: string;
  name: string;
  email: string;
  role: "master" | "sub";
  permissions: string[];
  totp_enabled: boolean;
  must_change_password: boolean;
  disabled: boolean;
  last_login_at: string | null;
  created_at: string;
}

function PermissionPicker({ value, onChange }: { value: Permission[]; onChange: (v: Permission[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Permissions</legend>
      {SUB_GRANTABLE.map((p) => (
        <label key={p} className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={value.includes(p)} onChange={(e) => onChange(e.target.checked ? [...value, p] : value.filter((x) => x !== p))} />
          <span>
            {PERMISSIONS[p]}
            {p === "agents.unlock" ? <span className="ml-1 text-xs text-[var(--muted-foreground)]">(optional)</span> : null}
          </span>
        </label>
      ))}
      <p className="pt-1 text-xs text-[var(--muted-foreground)]">Payments approval, refunds, plan changes, deleting agents, changing emails, managing admins, the audit log and settings stay with master admins.</p>
    </fieldset>
  );
}

export default function AdminManager({ admins, myId }: { admins: AdminItem[]; myId: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", permissions: [...SUB_DEFAULT] as Permission[] });
  const [editing, setEditing] = useState<AdminItem | null>(null);
  const [editPerms, setEditPerms] = useState<Permission[]>([]);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async <T,>(path: string, json: Record<string, unknown>): Promise<T | null> => {
    setBusy(true);
    const r = await api<T>(path, { json });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error?.message ?? "Something went wrong.");
      return null;
    }
    toast.success(r.message ?? "Saved.");
    router.refresh();
    return (r.data ?? (true as unknown as T)) as T;
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await call<{ temporaryPassword: string }>("/api/admins", form);
    if (data) {
      setSecret({ email: form.email, password: data.temporaryPassword });
      setCreating(false);
      setForm({ name: "", email: "", permissions: [...SUB_DEFAULT] });
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setCreating(true)} className={primaryBtn}>
          <UserPlus className="h-4 w-4" /> Add sub-admin
        </button>
      </div>

      <ul className="grid gap-3">
        {admins.map((a) => (
          <li key={a.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-bold text-brand-neon">{a.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                    {a.name}
                    {a.id === myId ? <span className="text-xs font-normal text-[var(--muted-foreground)]">(you)</span> : null}
                    <Badge tone={a.role === "master" ? "brand" : "neutral"}>{a.role === "master" ? "Master" : "Sub admin"}</Badge>
                    {a.disabled ? <Badge tone="red">Disabled</Badge> : null}
                    {!a.totp_enabled ? <Badge tone="amber">2-step not set up</Badge> : null}
                    {a.must_change_password && !a.disabled ? <Badge tone="amber">Temporary password</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">{a.email} · last sign-in {a.last_login_at ? timeAgo(a.last_login_at) : "never"}</p>
                  {a.role === "sub" ? (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{a.permissions.length} permission{a.permissions.length === 1 ? "" : "s"}{a.permissions.includes("agents.unlock") ? " · can unlock accounts" : ""}</p>
                  ) : null}
                </div>
              </div>
              {a.role === "sub" ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setEditing(a); setEditPerms(a.permissions.filter((p): p is Permission => (SUB_GRANTABLE as string[]).includes(p))); }} className={secondaryBtn}>
                    <ShieldCheck className="h-4 w-4" /> Permissions
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!confirm(`Create a new temporary password for ${a.name}? Their current password stops working.`)) return;
                      const data = await call<{ temporaryPassword: string }>(`/api/admins/${a.id}`, { action: "reset_password" });
                      if (data) setSecret({ email: a.email, password: data.temporaryPassword });
                    }}
                    className={secondaryBtn}
                  >
                    <KeyRound className="h-4 w-4" /> Reset password
                  </button>
                  {a.totp_enabled ? (
                    <button type="button" disabled={busy} onClick={() => confirm(`Reset 2-step verification for ${a.name}? Use this if they lost their phone.`) && call(`/api/admins/${a.id}`, { action: "reset_2fa" })} className={secondaryBtn}>
                      <Smartphone className="h-4 w-4" /> Reset 2-step
                    </button>
                  ) : null}
                  {a.disabled ? (
                    <button type="button" disabled={busy} onClick={() => call(`/api/admins/${a.id}`, { action: "enable" })} className={secondaryBtn}>Enable</button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => confirm(`Disable ${a.name}? They're signed out immediately.`) && call(`/api/admins/${a.id}`, { action: "disable" })} className={secondaryBtn}>
                      <ShieldOff className="h-4 w-4 text-rose-500" /> Disable
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {admins.length === 1 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><Users className="h-4 w-4" /> Add sub-admins for your support and operations team.</p>
      ) : null}

      <Modal open={creating} onOpenChange={setCreating} title="Add a sub-admin" description="They get a temporary password and must set up 2-step verification when they first sign in.">
        <form onSubmit={create} className="space-y-4">
          <Field label="Name" htmlFor="new-name">
            <input id="new-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} className={inputCls} required />
          </Field>
          <Field label="Work email" htmlFor="new-email">
            <input id="new-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} required />
          </Field>
          <PermissionPicker value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className={secondaryBtn}>Cancel</button>
            <button type="submit" disabled={busy || !form.name || !form.email || !form.permissions.length} className={primaryBtn}>
              {busy ? <Spinner /> : null} Create sub-admin
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onOpenChange={(v) => !v && setEditing(null)} title={editing ? `Permissions for ${editing.name}` : ""}>
        <PermissionPicker value={editPerms} onChange={setEditPerms} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(null)} className={secondaryBtn}>Cancel</button>
          <button
            type="button"
            disabled={busy || !editPerms.length}
            onClick={async () => {
              if (editing && (await call(`/api/admins/${editing.id}`, { action: "permissions", permissions: editPerms }))) setEditing(null);
            }}
            className={primaryBtn}
          >
            {busy ? <Spinner /> : null} Save permissions
          </button>
        </div>
      </Modal>

      <Modal open={!!secret} onOpenChange={(v) => !v && setSecret(null)} title="Temporary password" description="Shown only once. Share it with the admin privately (not by email with the sign-in address). They must change it at first sign-in.">
        {secret ? (
          <>
            <p className="text-xs text-[var(--muted-foreground)]">{secret.email}</p>
            <div className="mt-2 flex gap-2">
              <input readOnly value={secret.password} className={`${inputCls} font-mono`} onFocus={(e) => e.target.select()} />
              <button type="button" onClick={() => void navigator.clipboard.writeText(secret.password).then(() => toast.success("Copied."))} className={secondaryBtn} aria-label="Copy password">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
