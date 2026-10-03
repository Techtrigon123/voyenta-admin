"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { cn, formatDate } from "@/lib/utils";
import { Spinner, inputCls, primaryBtn } from "@/components/ui";

interface Message {
  id: string;
  from: "agent" | "support";
  body: string;
  created_at: string;
}

export default function Thread({ agentId, initial }: { agentId: string; initial: Message[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const r = await api<Message>(`/api/support/${agentId}`, { json: { body: text } });
    setBusy(false);
    if (!r.success || !r.data) return toast.error(r.error?.message ?? "Could not send.");
    setMessages((m) => [...m, r.data!]);
    setText("");
    router.refresh();
  };

  return (
    <div className="flex h-[calc(100dvh-16rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? <p className="text-center text-sm text-[var(--muted-foreground)]">No messages yet. Start the conversation below.</p> : null}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.from === "support" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                m.from === "support" ? "rounded-br-md bg-ink text-white dark:bg-brand-600" : "rounded-bl-md bg-[var(--muted)]"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cn("mt-1 text-[10px]", m.from === "support" ? "text-white/60" : "text-[var(--muted-foreground)]")}>
                {m.from === "support" ? "Voyenta support" : "Agent"} · {formatDate(m.created_at, true)}
              </p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-[var(--border)] p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e);
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Write a reply… (Enter to send, Shift+Enter for a new line)"
          className={`${inputCls} h-auto min-h-10 resize-none py-2`}
          aria-label="Reply"
        />
        <button type="submit" disabled={busy || !text.trim()} className={primaryBtn} aria-label="Send reply">
          {busy ? <Spinner /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
