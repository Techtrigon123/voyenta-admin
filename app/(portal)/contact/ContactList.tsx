"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Mail, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/utils";
import { Badge, secondaryBtn } from "@/components/ui";

export interface ContactItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  topic: string;
  message: string;
  status: "new" | "replied" | "closed";
  created_at: string;
}

export default function ContactList({ items }: { items: ContactItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const setStatus = async (id: string, status: ContactItem["status"]) => {
    setBusy(id);
    const r = await api(`/api/contact/${id}`, { json: { status } });
    setBusy(null);
    if (!r.success) return toast.error(r.error?.message ?? "Could not update.");
    toast.success(r.message ?? "Updated.");
    router.refresh();
  };

  return (
    <ul className="grid gap-3">
      {items.map((m) => (
        <li key={m.id} className="anim-rise rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">
                {m.name} {m.company ? <span className="font-normal text-[var(--muted-foreground)]">· {m.company}</span> : null}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {m.email}
                {m.phone ? ` · ${m.phone}` : ""} · {timeAgo(m.created_at)}
              </p>
            </div>
            <Badge tone="brand" className="capitalize">{m.topic.replace(/_/g, " ")}</Badge>
          </div>
          <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[var(--muted)] p-3 text-sm">{m.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: your message to Voyenta")}`}
              className={secondaryBtn}
              onClick={() => {
                if (m.status === "new") void setStatus(m.id, "replied");
              }}
            >
              <Mail className="h-4 w-4" /> Reply by email
            </a>
            {m.status === "new" ? (
              <button type="button" disabled={busy === m.id} onClick={() => setStatus(m.id, "replied")} className={secondaryBtn}>
                <CheckCheck className="h-4 w-4" /> Mark replied
              </button>
            ) : null}
            {m.status !== "closed" ? (
              <button type="button" disabled={busy === m.id} onClick={() => setStatus(m.id, "closed")} className={secondaryBtn}>
                <X className="h-4 w-4" /> Close
              </button>
            ) : (
              <button type="button" disabled={busy === m.id} onClick={() => setStatus(m.id, "new")} className={secondaryBtn}>
                <RotateCcw className="h-4 w-4" /> Reopen
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
