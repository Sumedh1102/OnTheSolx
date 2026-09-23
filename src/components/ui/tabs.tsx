"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const listCls = "inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border-2 border-ink bg-white p-1 scrollbar-none";
const tabCls =
  "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-bold transition focus-visible:outline-3 focus-visible:outline-brand";

/** Client-side tabs for in-page content switching. */
export function Tabs({ tabs, defaultTab, className }: { tabs: { id: string; label: ReactNode; content: ReactNode }[]; defaultTab?: string; className?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const base = useId();
  return (
    <div className={className}>
      <div role="tablist" className={listCls}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={cn(tabCls, active === t.id ? "bg-ink text-white" : "hover:bg-paper")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-panel-${t.id}`} aria-labelledby={`${base}-tab-${t.id}`} hidden={active !== t.id} className="mt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}

/** URL-driven tabs (server friendly): each tab is a link. */
export function LinkTabs({ tabs, active, className }: { tabs: { id: string; label: ReactNode; href: string; count?: number }[]; active: string; className?: string }) {
  return (
    <nav className={cn(listCls, className)} aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={active === t.id ? "page" : undefined} className={cn(tabCls, "inline-flex items-center gap-1.5", active === t.id ? "bg-ink text-white" : "hover:bg-paper")}>
          {t.label}
          {t.count !== undefined ? (
            <span className={cn("rounded-md px-1.5 text-xs", active === t.id ? "bg-white/20" : "bg-paper-2")}>{t.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
