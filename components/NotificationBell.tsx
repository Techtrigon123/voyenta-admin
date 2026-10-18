"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Bell, BellOff, Bug, IndianRupee, PhoneCall, Ticket, Volume2, VolumeX } from "lucide-react";
import { api } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";

/*
 * Admin notification bell. One hook (useAdminNotifications) polls /api/notifications every 20 s
 * while the tab is visible, tracks what this admin has already seen, and rings — a swing animation
 * plus a short chime — when something new arrives. The bell components only render that state, so
 * the desktop sidebar and the mobile header share one poll and one chime.
 */

type Kind = "ticket" | "bug" | "callback" | "payment" | "verification";
export interface AdminNotification {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  at: string;
  href: string;
}

const POLL_MS = 20_000;
const SEEN_KEY = (adminId: string) => `vouchlio-admin-notifications-seen:${adminId}`;
const MUTE_KEY = "vouchlio-admin-notifications-muted";

/* ─── Chime: generated with Web Audio, so there's no sound file to load ─────── */

let audio: AudioContext | null = null;
function audioContext(): AudioContext | null {
  try {
    audio ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return audio;
  } catch {
    return null;
  }
}

/** Two soft bell tones (like a desk bell): E6 then B6, each with a quick attack and a gentle fade. */
function playChime() {
  const ctx = audioContext();
  if (!ctx) return;
  void ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const tone = (freq: number, start: number, length: number) => {
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    overtone.type = "sine";
    osc.frequency.value = freq;
    overtone.frequency.value = freq * 2.01;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
    const soft = ctx.createGain();
    soft.gain.value = 0.25;
    osc.connect(gain);
    overtone.connect(soft).connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    overtone.start(now + start);
    osc.stop(now + start + length + 0.05);
    overtone.stop(now + start + length + 0.05);
  };
  tone(1318.5, 0, 0.6);
  tone(1975.5, 0.14, 0.75);
}

/* ─── Shared state ──────────────────────────────────────────────────────────── */

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked: everything counts as unread this session
  }
}

export function useAdminNotifications(adminId: string) {
  const router = useRouter();
  const [items, setItems] = useState<AdminNotification[]>([]);
  // Read once from this browser. Safe to do during render: nothing the server renders depends on it
  // (the list starts empty on both sides, so the badge and panel match during hydration).
  const [seenAt, setSeenAt] = useState<string>(() => readStorage(SEEN_KEY(adminId)) ?? "");
  const [muted, setMuted] = useState(() => readStorage(MUTE_KEY) === "1");
  const [ringing, setRinging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const known = useRef<Set<string> | null>(null);
  const inFlight = useRef(false);
  const mutedRef = useRef(muted);

  // Browsers only allow sound after the user has interacted with the page; unlock on first input.
  useEffect(() => {
    const unlock = () => void audioContext()?.resume().catch(() => {});
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const ring = useCallback(() => {
    setRinging(false);
    // Restart the animation even if it was mid-swing.
    requestAnimationFrame(() => setRinging(true));
    window.setTimeout(() => setRinging(false), 1400);
    if (!mutedRef.current) playChime();
  }, []);

  const poll = useCallback(async () => {
    if (inFlight.current || document.hidden) return;
    inFlight.current = true;
    try {
      const r = await api<{ items: AdminNotification[] }>("/api/notifications");
      if (!r.success || !r.data) return;
      const next = r.data.items;
      const prev = known.current;
      known.current = new Set(next.map((n) => n.id));
      setItems(next);
      setLoaded(true);
      if (prev === null) {
        // First load after signing in / opening the portal: ring once if anything is unread.
        let seen = "";
        try {
          seen = localStorage.getItem(SEEN_KEY(adminId)) ?? "";
        } catch {
          /* ignore */
        }
        if (next.some((n) => n.at > seen)) ring();
        return;
      }
      const fresh = next.filter((n) => !prev.has(n.id));
      if (fresh.length) {
        ring();
        router.refresh(); // keep the sidebar counts and the current page in step
      } else if (next.length !== prev.size) {
        router.refresh(); // something was handled elsewhere
      }
    } finally {
      inFlight.current = false;
    }
  }, [adminId, ring, router]);

  // Poll every 20 s while visible; check straight away when the tab comes back.
  useEffect(() => {
    void poll();
    const t = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [poll]);

  const unread = items.filter((n) => n.at > seenAt);

  const markSeen = useCallback(() => {
    const newest = items.reduce((m, n) => (n.at > m ? n.at : m), seenAt);
    if (newest === seenAt) return;
    setSeenAt(newest);
    try {
      localStorage.setItem(SEEN_KEY(adminId), newest);
    } catch {
      /* ignore */
    }
  }, [items, seenAt, adminId]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const v = !m;
      mutedRef.current = v;
      try {
        localStorage.setItem(MUTE_KEY, v ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (!v) playChime(); // preview the sound when turning it back on
      return v;
    });
  }, []);

  return { items, unread, seenAt, muted, ringing, loaded, markSeen, toggleMute };
}

export type NotificationState = ReturnType<typeof useAdminNotifications>;

/* ─── Bell + panel ─────────────────────────────────────────────────────────── */

const KIND: Record<Kind, { icon: typeof Bell; tone: string; label: string }> = {
  ticket: { icon: Ticket, tone: "bg-sky-500/15 text-sky-300", label: "Ticket" },
  bug: { icon: Bug, tone: "bg-rose-500/15 text-rose-300", label: "Bug" },
  callback: { icon: PhoneCall, tone: "bg-violet-500/15 text-violet-300", label: "Callback" },
  payment: { icon: IndianRupee, tone: "bg-amber-500/15 text-amber-300", label: "Payment" },
  verification: { icon: BadgeCheck, tone: "bg-emerald-500/15 text-emerald-300", label: "Profile review" },
};

export function NotificationBell({ state, align = "left" }: { state: NotificationState; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const count = state.unread.length;

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((o) => {
      if (!o) window.setTimeout(state.markSeen, 1200); // mark read once the panel has been seen
      return !o;
    });
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={count ? `${count} new notification${count === 1 ? "" : "s"}` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-neutral-300 transition hover:bg-white/10 hover:text-white"
      >
        <Bell className={cn("h-5 w-5", state.ringing && "bell-ring")} />
        {count ? (
          <span key={count} className="badge-pop absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--sidebar)]">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
        {state.ringing ? <span aria-hidden className="absolute inset-0 animate-ping rounded-xl bg-rose-500/20" /> : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className={cn(
            "absolute top-full z-[60] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#121218] text-white shadow-2xl shadow-black/50",
            align === "left" ? "left-0" : "right-0"
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold">
              Notifications {count ? <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold">{count} new</span> : null}
            </p>
            <button
              type="button"
              onClick={state.toggleMute}
              aria-label={state.muted ? "Turn notification sound on" : "Mute notification sound"}
              title={state.muted ? "Sound off" : "Sound on"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/10 hover:text-white"
            >
              {state.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!state.loaded ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">Loading…</p>
            ) : state.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <BellOff className="h-6 w-6 text-neutral-500" />
                <p className="text-sm font-medium">You&apos;re all caught up</p>
                <p className="text-xs text-neutral-400">New tickets, callback requests and online payments appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {state.items.map((n) => {
                  const k = KIND[n.kind];
                  const isNew = n.at > state.seenAt;
                  return (
                    <li key={n.id}>
                      <Link href={n.href} onClick={() => setOpen(false)} className={cn("flex gap-3 px-4 py-3 transition hover:bg-white/5", isNew && "bg-white/[0.03]")}>
                        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", k.tone)}>
                          <k.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-[13px] font-semibold leading-snug">{n.title}</span>
                            {isNew ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-label="New" /> : null}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-neutral-400">{n.body}</span>
                          <span className="mt-1 block text-[11px] text-neutral-500">
                            {k.label} · {timeAgo(n.at)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 border-t border-white/10 text-center text-xs">
            <Link href="/tickets" onClick={() => setOpen(false)} className="border-r border-white/10 py-2.5 text-neutral-300 hover:bg-white/5 hover:text-white">Tickets</Link>
            <Link href="/callbacks" onClick={() => setOpen(false)} className="py-2.5 text-neutral-300 hover:bg-white/5 hover:text-white">Callbacks</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
