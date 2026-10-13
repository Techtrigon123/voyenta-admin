"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  name: string;
  url: string;
  /** Shown instead of the label on small screens; without one the label always shows. */
  icon?: LucideIcon;
}

interface NavBarProps {
  items: NavItem[];
  /** Name of the active item. The page knows this from the URL, so it is passed in. */
  active?: string;
  /** Unique per bar on the page, so two bars don't share the sliding lamp. */
  layoutId?: string;
  className?: string;
}

/**
 * Tubelight tab bar: a lamp glows above the active item and slides to the next one.
 * Positioned inline; pass e.g. "fixed bottom-0 left-1/2 -translate-x-1/2" for a floating bar.
 */
export function NavBar({ items, active, layoutId = "lamp", className }: NavBarProps) {
  // Move the lamp the moment a tab is clicked, then follow the page's `active` once it arrives.
  const [clicked, setClicked] = useState<string | null>(null);
  const [lastActive, setLastActive] = useState(active);
  if (lastActive !== active) {
    setLastActive(active);
    setClicked(null);
  }
  const current = clicked ?? active ?? items[0]?.name;

  return (
    <div className={cn("w-full overflow-x-auto pt-2", className)}>
      <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)]/60 p-1 shadow-lg backdrop-blur-lg">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = current === item.name;

          return (
            <Link
              key={item.name}
              href={item.url}
              onClick={() => setClicked(item.name)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative cursor-pointer whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                "text-[var(--muted-foreground)] hover:text-brand-600 dark:hover:text-brand-neon",
                isActive && "bg-[var(--muted)] text-brand-700 dark:text-brand-neon"
              )}
            >
              {Icon ? (
                <>
                  <span className="hidden md:inline">{item.name}</span>
                  <span className="md:hidden">
                    <Icon size={18} strokeWidth={2.5} />
                  </span>
                </>
              ) : (
                item.name
              )}
              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className="absolute inset-0 -z-10 w-full rounded-full bg-brand-500/5"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-brand-500 dark:bg-brand-neon">
                    <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-brand-500/20 blur-md dark:bg-brand-neon/20" />
                    <div className="absolute -top-1 h-6 w-8 rounded-full bg-brand-500/20 blur-md dark:bg-brand-neon/20" />
                    <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-brand-500/20 blur-sm dark:bg-brand-neon/20" />
                  </div>
                </motion.div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default NavBar;
