"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  CreditCard,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  ScrollText,
  Settings,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Permission } from "@/lib/permissions";
import { setTheme, useTheme } from "@/lib/theme";
import { api } from "@/lib/client";
import type { AdminView } from "@/lib/auth/guard";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  count?: "payments" | "support" | "reviews";
}

const NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Operations",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/payments", label: "Plan payments", icon: CreditCard, permission: "payments.view", count: "payments" },
      { href: "/verifications", label: "Profile reviews", icon: BadgeCheck, permission: "agents.verify", count: "reviews" },
      { href: "/agents", label: "Agents", icon: Users, permission: "agents.view" },
      { href: "/support", label: "Support chats", icon: MessageCircle, permission: "support.reply", count: "support" },
      { href: "/contact", label: "Contact messages", icon: Inbox, permission: "contact.manage" },
      { href: "/reports", label: "Reports", icon: BarChart3, permission: "reports.activity" },
    ],
  },
  {
    heading: "Owner",
    items: [
      { href: "/admins", label: "Admins", icon: UserCog, permission: "admins.manage" },
      { href: "/audit", label: "Audit log", icon: ScrollText, permission: "audit.view" },
      { href: "/settings", label: "Settings", icon: Settings, permission: "settings.manage" },
    ],
  },
];

export default function Sidebar({ admin, counts }: { admin: AdminView; counts: { payments: number; support: number; reviews: number } }) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  // Close the mobile menu after navigating (adjusting state during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4" aria-label="Admin">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.permission || can(admin, i.permission));
        if (!items.length) return null;
        return (
          <div key={group.heading}>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">{group.heading}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = active(item.href);
                const n = item.count ? counts[item.count] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                        isActive ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-brand-neon" : "text-neutral-500 group-hover:text-neutral-300")} />
                      <span className="flex-1">{item.label}</span>
                      {n > 0 ? <span className="rounded-full bg-brand-neon px-1.5 py-0.5 text-[10px] font-bold text-ink">{n > 99 ? "99+" : n}</span> : null}
                      {isActive ? <span className="h-5 w-1 rounded-full bg-brand-neon" aria-hidden /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-3">
      <Link href="/account" className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-neon">
          {admin.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{admin.name}</span>
          <span className="flex items-center gap-1 text-[11px] text-neutral-400">
            <ShieldCheck className="h-3 w-3 text-brand-neon" /> {admin.role === "master" ? "Master admin" : "Sub admin"}
          </span>
        </span>
      </Link>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-xs font-medium text-neutral-300 hover:bg-white/5"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button type="button" onClick={logout} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/10">
          <LogOut className="h-3.5 w-3.5" /> Log out
        </button>
      </div>
    </div>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-3 px-5 py-5">
      <span className="rounded-lg bg-[#ffffff] px-1.5 py-1">
        <Image src="/voyenta-logo-mark.png" alt="" width={234} height={160} className="h-6 w-auto" priority />
      </span>
      <span className="font-bold text-white">
        Voyenta <span className="text-brand-neon">Admin</span>
      </span>
    </Link>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between bg-[var(--sidebar)] px-4 py-3 lg:hidden">
        <span className="flex items-center gap-2 font-bold text-white">
          <span className="rounded-md bg-[#ffffff] px-1 py-0.5">
            <Image src="/voyenta-logo-mark.png" alt="" width={234} height={160} className="h-5 w-auto" />
          </span>
          Voyenta <span className="text-brand-neon">Admin</span>
        </span>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-white hover:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[var(--sidebar)] lg:flex">
        <div className="h-[3px] bg-gradient-to-r from-ink via-brand-500 to-brand-neon" />
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-[var(--sidebar)] shadow-2xl">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-white hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      ) : null}
    </>
  );
}
