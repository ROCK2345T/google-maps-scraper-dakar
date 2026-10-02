"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Search, History, UserCog, LogOut, Menu, X, Building2, Activity, Inbox, ScrollText, Settings2, Shield,
} from "lucide-react";
import { Logo, cx } from "./ui";
import { api } from "./api-client";

const ICONS = { LayoutDashboard, Search, History, UserCog, Building2, Activity, Inbox, ScrollText, Settings2 } as const;
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export function Shell({
  nav, user, area, banner, children,
}: {
  nav: NavItem[];
  user: { name: string; email: string; org?: string | null };
  area: "client" | "admin";
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  };

  const isActive = (href: string) => (href === "/app" || href === "/admin" ? pathname === href : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href={area === "admin" ? "/admin" : "/app"}><Logo light /></Link>
      </div>
      {area === "admin" && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-sun">
          <Shield className="size-4" /> Console administrateur
        </div>
      )}
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cx(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-white text-brand-800 shadow-sm" : "text-brand-50/85 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className={cx("size-5", active ? "text-brand-600" : "text-brand-200 group-hover:text-white")} />
              <span className="flex-1">{item.label}</span>
              {!!item.badge && <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-bold text-slate-900">{item.badge}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-xl bg-white/10 p-3">
        <p className="truncate text-sm font-semibold text-white">{user.name}</p>
        <p className="truncate text-xs text-brand-100/80">{user.org ?? user.email}</p>
        <button onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20">
          <LogOut className="size-4" /> Se déconnecter
        </button>
      </div>
      <div className="flag-bar h-1" />
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-gradient-to-b from-brand-800 to-brand-900 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-gradient-to-b from-brand-800 to-brand-900">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 text-white" aria-label="Fermer le menu"><X className="size-6" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu className="size-6 text-slate-700" /></button>
          <Logo />
        </header>
        {banner}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
