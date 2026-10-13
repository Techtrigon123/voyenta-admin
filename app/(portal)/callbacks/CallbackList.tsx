"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Phone } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { Badge, Spinner, inputCls, primaryBtn, secondaryBtn, type Tone } from "@/components/ui";

interface Item {
  id: string;
  agentName: string;
  agentEmail: string;
  phone: string;
  preferred_date: string;
  preferred_slot: string;
  topic: string;
  note: string | null;
  status: "requested" | "scheduled" | "completed" | "cancelled" | "missed";
  scheduled_at: string | null;
  admin_note: string | null;
  created_at: string;
}

const STATUS: Record<Item["status"], [string, Tone]> = {
  requested: ["Requested", "amber"],
  scheduled: ["Scheduled", "blue"],
  completed: ["Completed", "green"],
  cancelled: ["Cancelled", "neutral"],
  missed: ["Missed", "red"],
};
const SLOT: Record<string, { label: string; hour: number }> = {
  morning: { label: "Morning · 10 am – 1 pm", hour: 10 },
  afternoon: { label: "Afternoon · 1 pm – 4 pm", hour: 13 },
  evening: { label: "Evening · 4 pm – 7 pm", hour: 16 },
};

/** The preferred day and slot start, as a value for <input type="datetime-local"> (browser time). */
const suggested = (it: Item) => `${it.preferred_date}T${String(SLOT[it.preferred_slot]?.hour ?? 10).padStart(2, "0")}:00`;

function Row({ it }: { it: Item }) {
  const router = useRouter();
  const [when, setWhen] = useState(it.scheduled_at ? it.scheduled_at.slice(0, 16) : suggested(it));
  const [note, setNote] = useState(it.admin_note ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const open = it.status === "requested" || it.status === "scheduled";

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    const r = await api(`/api/callbacks/${it.id}`, { json: { action, note, ...extra } });
    setBusy(null);
    if (!r.success) return toast.error(r.error?.message ?? "Could not update.");
    toast.success(r.message ?? "Updated.");
    router.refresh();
  };

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {it.agentName} <Badge tone={STATUS[it.status][1]}>{STATUS[it.status][0]}</Badge>
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">{it.agentEmail} · requested {timeAgo(it.created_at)}</p>
        </div>
        <a href={`tel:${it.phone.replace(/\s/g, "")}`} className={cn(secondaryBtn, "h-9")}>
          <Phone className="h-4 w-4" /> {it.phone}
        </a>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <p className="rounded-xl bg-[var(--muted)] p-2.5"><span className="block text-xs text-[var(--muted-foreground)]">Topic</span>{it.topic}</p>
        <p className="rounded-xl bg-[var(--muted)] p-2.5"><span className="block text-xs text-[var(--muted-foreground)]">Preferred</span>{formatDate(it.preferred_date)} · {SLOT[it.preferred_slot]?.label ?? it.preferred_slot}</p>
        <p className="rounded-xl bg-[var(--muted)] p-2.5"><span className="block text-xs text-[var(--muted-foreground)]">Booked for</span>{it.scheduled_at ? formatDate(it.scheduled_at, true) : "Not scheduled yet"}</p>
      </div>
      {it.note ? <p className="rounded-xl border border-[var(--border)] p-2.5 text-sm"><span className="block text-xs text-[var(--muted-foreground)]">Agent&apos;s note</span>{it.note}</p> : null}
      {open ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Call at
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={cn(inputCls, "mt-1 w-56")} />
          </label>
          <label className="min-w-[220px] flex-1 text-xs font-medium text-[var(--muted-foreground)]">
            Note to the agent (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Our team will call from +91 80 1234 5678" className={cn(inputCls, "mt-1")} />
          </label>
          <button type="button" disabled={!!busy} onClick={() => void act("schedule", { scheduledAt: new Date(when).toISOString() })} className={primaryBtn}>
            {busy === "schedule" ? <Spinner /> : <CalendarClock className="h-4 w-4" />} {it.status === "scheduled" ? "Reschedule" : "Schedule"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => void act("complete")} className={secondaryBtn}>
            {busy === "complete" ? <Spinner /> : null} Completed
          </button>
          <button type="button" disabled={!!busy} onClick={() => void act("missed")} className={secondaryBtn}>
            Missed
          </button>
          <button type="button" disabled={!!busy} onClick={() => void act("cancel")} className={cn(secondaryBtn, "text-rose-600")}>
            Cancel
          </button>
        </div>
      ) : it.admin_note ? (
        <p className="text-xs text-[var(--muted-foreground)]">Note: {it.admin_note}</p>
      ) : null}
    </li>
  );
}

export default function CallbackList({ items }: { items: Item[] }) {
  return (
    <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      {items.map((it) => (
        <Row key={it.id} it={it} />
      ))}
    </ul>
  );
}
