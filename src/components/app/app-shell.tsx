"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, Bell, LogOut, MoreHorizontal, UserRound, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/misc";
import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-config";
import { NavIcon } from "./nav-icon";

type ShellUser = { name: string; email: string; roleLabel: string; avatarUrl: string | null };

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  const groups: { name: string | undefined; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return (
    <nav aria-label="Dashboard" className="grid gap-5">
      {groups.map((g, i) => (
        <div key={g.name ?? i}>
          {g.name && g.name !== "Overview" ? <p className="mb-1.5 px-3 font-mono text-[11px] font-bold uppercase tracking-widest text-muted">{g.name}</p> : null}
          <ul className="grid gap-1">
            {g.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border-2 px-3 py-2 text-[15px] font-bold transition",
                      active ? "border-ink bg-brand text-white shadow-brutal-xs" : "border-transparent hover:border-ink/15 hover:bg-paper",
                    )}
                  >
                    <NavIcon name={item.icon} className="size-[18px]" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  user,
  nav,
  mobileNav,
  unread,
  logoutAction,
  children,
}: {
  user: ShellUser;
  nav: NavItem[];
  mobileNav: NavItem[];
  unread: number;
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);

  const showMore = nav.length > mobileNav.length;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r-3 border-ink bg-white lg:flex" data-print-hide>
        <div className="border-b-3 border-ink px-5 py-4">
          <Logo href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav items={nav} pathname={pathname} />
        </div>
        <div className="border-t-3 border-ink p-3">
          <Link href="/book" className="mb-3 flex items-center justify-between rounded-xl border-[2.5px] border-ink bg-ink px-3 py-2.5 font-display font-extrabold text-white shadow-brutal-xs hover:-translate-y-0.5">
            Book a court <ArrowUpRight className="size-4" />
          </Link>
          <div className="flex items-center gap-3 rounded-xl px-1">
            <Avatar name={user.name} src={user.avatarUrl} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{user.name}</p>
              <p className="truncate text-xs font-semibold text-muted">{user.roleLabel}</p>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="grid size-9 place-items-center rounded-lg border-2 border-ink bg-white hover:bg-danger-soft" aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b-3 border-ink bg-paper/95 px-4 backdrop-blur sm:px-6" data-print-hide>
          <div className="flex items-center gap-3 lg:hidden">
            <Logo href="/dashboard" />
          </div>
          <p className="hidden text-sm font-bold text-muted lg:block">
            Signed in as <span className="text-ink">{user.email}</span> · {user.roleLabel}
          </p>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/notifications" className="relative grid size-10 place-items-center rounded-xl border-[2.5px] border-ink bg-white shadow-brutal-xs hover:-translate-y-0.5" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <Bell className="size-[18px]" strokeWidth={2.5} />
              {unread ? (
                <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-brand px-1 text-[11px] font-extrabold text-white">{unread > 9 ? "9+" : unread}</span>
              ) : null}
            </Link>
            <Dropdown
              label="Account menu"
              trigger={
                <span className="flex cursor-pointer items-center gap-2 rounded-xl border-[2.5px] border-ink bg-white p-0.5 pr-2 shadow-brutal-xs">
                  <Avatar name={user.name} src={user.avatarUrl} size={32} className="rounded-lg" />
                  <span className="hidden max-w-28 truncate text-sm font-bold sm:block">{user.name.split(" ")[0]}</span>
                </span>
              }
              items={[
                { href: "/dashboard/profile", label: "Profile & preferences", icon: <UserRound className="size-4" /> },
                { href: "/dashboard/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
                { href: "/", label: "Back to website", icon: <ArrowUpRight className="size-4" /> },
                { type: "separator" },
                { type: "button", label: "Sign out", icon: <LogOut className="size-4" />, danger: true, onSelect: () => void logoutAction() },
              ]}
            />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[90rem] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t-3 border-ink bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" data-print-hide>
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileNav.length + (showMore ? 1 : 0)}, minmax(0, 1fr))` }}>
          {mobileNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-bold">
                  <span className={cn("grid h-8 w-12 place-items-center rounded-lg border-2 transition", active ? "border-ink bg-brand text-white" : "border-transparent")}>
                    <NavIcon name={item.icon} className="size-5" />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          {showMore ? (
            <li>
              <button type="button" onClick={() => setDrawer(true)} className="flex w-full flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-bold" aria-expanded={drawer}>
                <span className="grid h-8 w-12 place-items-center rounded-lg border-2 border-transparent">
                  <MoreHorizontal className="size-5" strokeWidth={2.5} />
                </span>
                More
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      {/* Mobile drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-ink/50" onClick={() => setDrawer(false)} aria-label="Close menu" />
          <div className="animate-pop absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-3 border-ink bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-xl font-extrabold">Menu</p>
              <button type="button" onClick={() => setDrawer(false)} className="grid size-9 place-items-center rounded-lg border-2 border-ink" aria-label="Close menu">
                <X className="size-4" strokeWidth={3} />
              </button>
            </div>
            <SidebarNav items={nav} pathname={pathname} onNavigate={() => setDrawer(false)} />
            <form action={logoutAction} className="mt-5">
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink py-3 font-bold text-danger">
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
