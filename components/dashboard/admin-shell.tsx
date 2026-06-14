"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { labels } from "@/lib/labels";
import { supabase } from "@/lib/supabase";

function navLinkClass(isActive: boolean) {
  return isActive
    ? "block rounded-lg bg-gradient-to-r from-[var(--brand)] to-[var(--accent-soft)] px-3 py-2 font-medium text-[var(--on-accent)]"
    : "block rounded-lg px-3 py-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900";
}

interface AdminShellProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminShell({ title, subtitle, actions, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isCreateEvent = pathname.startsWith("/admin/events/new");
  const isCategories = pathname.startsWith("/admin/categories");
  const isCommunity = pathname.startsWith("/admin/community");
  const isSettings = pathname.startsWith("/admin/settings");
  const isDashboard =
    pathname === "/" ||
    pathname === "/admin" ||
    (pathname.startsWith("/admin/events/") && !isCreateEvent && !isCommunity);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login?loggedOut=1");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 md:grid-cols-[220px_1fr]">
        <aside className="border-b border-zinc-200 bg-white p-6 md:border-b-0 md:border-r">
          <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
            Woxpat
          </Link>
          <nav className="mt-8 space-y-2 text-sm">
            <Link href="/" className={navLinkClass(isDashboard && !isCreateEvent && !isCategories)}>
              {labels.dashboard}
            </Link>
            <Link href="/admin/events/new" className={navLinkClass(isCreateEvent)}>
              {labels.createEvent}
            </Link>
            <Link href="/admin/categories" className={navLinkClass(isCategories)}>
              {labels.categories}
            </Link>
            <Link href="/admin/community" className={navLinkClass(isCommunity)}>
              {labels.community}
            </Link>
            <Link href="/admin/settings" className={navLinkClass(isSettings)}>
              Ajustes
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className={`${navLinkClass(false)} w-full text-left`}
            >
              {labels.logout}
            </button>
          </nav>
        </aside>

        <main className="p-6 lg:p-10">
          <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
              <p className="mt-2 text-zinc-600">{subtitle}</p>
            </div>
            {actions}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
