"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { cn, formatDate } from "@/lib/utils";
import { Badge, Card, CardTitle, Spinner, inputCls, primaryBtn, secondaryBtn } from "@/components/ui";

type Status = "open" | "in_progress" | "waiting" | "resolved" | "closed";
type Priority = "low" | "normal" | "high" | "urgent";
interface Message {
  id: string;
  from: "agent" | "support";
  author_name: string | null;
  body: string;
  attachment: string | null;
  created_at: string;
}

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting on agent" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];
const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function TicketPanel({
  ticketId,
  initialMessages,
  initialStatus,
  initialPriority,
  assignedName,
  adminName,
}: {
  ticketId: string;
  initialMessages: Message[];
  initialStatus: Status;
  initialPriority: Priority;
  assignedName: string | null;
  adminName: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(initialPriority);
  const [assignee, setAssignee] = useState(assignedName);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const call = async <T,>(action: string, extra: Record<string, unknown>) => {
    setBusy(action);
    const r = await api<T>(`/api/tickets/${ticketId}`, { json: { action, ...extra } });
    setBusy(null);
    if (!r.success) toast.error(r.error?.message ?? "Could not update the ticket.");
    else if (r.message) toast.success(r.message);
    return r;
  };

  const reply = async (resolve: boolean) => {
    if (!text.trim()) return;
    const r = await call<{ message: Message; status: Status }>("reply", { body: text, resolve });
    if (!r.success || !r.data) return;
    setMessages((m) => [...m, r.data!.message]);
    setStatus(r.data.status);
    if (!assignee) setAssignee(adminName);
    setText("");
    router.refresh();
  };

  const closed = status === "closed";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Status
            <select
              value={status}
              disabled={!!busy}
              onChange={async (e) => {
                const v = e.target.value as Status;
                if ((await call("status", { status: v })).success) setStatus(v);
              }}
              className={cn(inputCls, "mt-1 w-44")}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            Priority
            <select
              value={priority}
              disabled={!!busy}
              onChange={async (e) => {
                const v = e.target.value as Priority;
                if ((await call("priority", { priority: v })).success) setPriority(v);
              }}
              className={cn(inputCls, "mt-1 w-36")}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-[var(--muted-foreground)]">Assigned:</span>
            <strong>{assignee ?? "Nobody"}</strong>
            <button
              type="button"
              disabled={!!busy}
              onClick={async () => {
                const mine = assignee === adminName;
                if ((await call("assign", { to: mine ? "none" : "me" })).success) setAssignee(mine ? null : adminName);
              }}
              className={cn(secondaryBtn, "h-8 px-3 text-xs")}
            >
              {assignee === adminName ? "Unassign" : "Assign to me"}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle hint={`${messages.length} message${messages.length === 1 ? "" : "s"}`}>Conversation</CardTitle>
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.from === "support" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", m.from === "support" ? "rounded-br-md bg-ink text-white dark:bg-brand-600" : "rounded-bl-md bg-[var(--muted)]")}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                {m.attachment ? (
                  <a href={m.attachment} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-[var(--border)] bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.attachment} alt="Screenshot attached by the agent" className="max-h-80 w-full object-contain" />
                  </a>
                ) : null}
                <p className={cn("mt-1 text-[10px]", m.from === "support" ? "text-white/60" : "text-[var(--muted-foreground)]")}>
                  {m.from === "support" ? m.author_name ?? "Vouchlio support" : "Agent"} · {formatDate(m.created_at, true)}
                </p>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
      </Card>

      {closed ? (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-4 text-sm text-[var(--muted-foreground)]">
          This ticket is closed. Change the status to reopen it before replying.
        </p>
      ) : (
        <Card>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
            rows={4}
            placeholder="Write a reply to the agent…"
            className={cn(inputCls, "h-auto py-2.5")}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">
              Signed as <Badge tone="brand">{adminName}</Badge> · the agent sees it in Support tickets
            </span>
            <div className="flex gap-2">
              <button type="button" disabled={!!busy || !text.trim()} onClick={() => void reply(true)} className={secondaryBtn}>
                {busy === "reply" ? <Spinner /> : null} Reply & resolve
              </button>
              <button type="button" disabled={!!busy || !text.trim()} onClick={() => void reply(false)} className={primaryBtn}>
                {busy === "reply" ? <Spinner /> : <Send className="h-4 w-4" />} Send reply
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
