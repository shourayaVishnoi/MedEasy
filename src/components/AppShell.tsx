"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  FlaskConical,
  History,
  Home,
  LineChart,
  Menu,
  MessageSquareText,
  Pill,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Logo } from "./Logo";
import { Modal } from "./ui";
import { SyncErrorBanner, SyncStatus } from "./SyncStatus";
import { update } from "@/lib/store";
import type { Workspace } from "@/lib/hooks";
import { cx } from "@/lib/util";

const NAV = [
  { href: "/app", label: "Today", icon: Home },
  { href: "/app/documents", label: "Records", icon: FileText },
  { href: "/app/medicines", label: "Medicines", icon: Pill },
  { href: "/app/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/app/compare", label: "Compare results", icon: LineChart },
  { href: "/app/timeline", label: "Timeline", icon: History },
  { href: "/app/assistant", label: "Assistant", icon: MessageSquareText },
  { href: "/app/search", label: "Search", icon: Search },
];
const NAV_SECONDARY = [
  { href: "/app/profile", label: "Profiles & family", icon: UserRound },
  { href: "/app/share", label: "Share & export", icon: Share2 },
  { href: "/app/privacy", label: "Privacy & security", icon: ShieldCheck },
  { href: "/app/settings", label: "Settings", icon: Settings },
];
const MOBILE = [NAV[0], NAV[1], NAV[2], NAV[6]];

function isActive(path: string, href: string) {
  return href === "/app" ? path === "/app" : path.startsWith(href);
}

export function AppShell({ ws, children }: { ws: Workspace; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const [q, setQ] = useState("");

  const ProfileSwitcher = (
    <label className="relative block">
      <span className="sr-only">Viewing records for</span>
      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <select
        value={ws.profileId}
        onChange={(e) => update((s) => ({ ...s, activeProfileId: e.target.value }), { action: "profile.switched", detail: "Active profile changed" })}
        className="h-10 w-full appearance-none rounded-xl border border-line bg-surface pl-9 pr-8 text-sm font-medium"
      >
        {ws.state.profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
            {p.relationship !== "self" ? ` (${p.relationship})` : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </label>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/70 px-4 py-5 backdrop-blur lg:flex">
        <Link href="/app" className="px-2">
          <Logo />
        </Link>
        <div className="mt-6">{ProfileSwitcher}</div>
        <nav aria-label="Main" className="mt-5 flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink key={n.href} {...n} active={isActive(path, n.href)} />
          ))}
          <div className="my-3 border-t border-line" />
          {NAV_SECONDARY.map((n) => (
            <NavLink key={n.href} {...n} active={isActive(path, n.href)} />
          ))}
        </nav>
        {ws.state.mode === "demo" ? (
          <div className="mt-4 rounded-2xl bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-ink-2">
            <p className="flex items-center gap-1.5 font-semibold text-warn">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Demo mode
            </p>
            Sample data, stored only in this browser.{" "}
            <Link href="/app/privacy#demo" className="underline underline-offset-2">
              Manage
            </Link>
          </div>
        ) : (
          <div className="mt-4 px-3">
            <SyncStatus />
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
            <Link href="/app" className="lg:hidden" aria-label="Home">
              <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
            </Link>
            <form
              role="search"
              className="relative min-w-0 flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/app/search?q=${encodeURIComponent(q)}`);
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search records…"
                aria-label="Search all records"
                className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm"
              />
            </form>
            <div className="w-40 shrink-0 lg:hidden">{ProfileSwitcher}</div>
            {ws.state.mode === "demo" ? (
              <span className="hidden items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn lg:inline-flex">
                <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Sample data
              </span>
            ) : (
              <span className="hidden sm:inline-flex">
                <SyncStatus compact />
              </span>
            )}
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">
          {ws.state.mode === "cloud" && <SyncErrorBanner />}
          {children}
        </main>
      </div>

      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {MOBILE.map((n) => (
            <li key={n.href}>
              <Link href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined} className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium", isActive(path, n.href) ? "text-pine" : "text-muted")}>
                <n.icon className="h-5 w-5" aria-hidden />
                {n.label}
              </Link>
            </li>
          ))}
          <li>
            <button onClick={() => setMore(true)} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-muted">
              <Menu className="h-5 w-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="More">
        <nav aria-label="More" className="grid grid-cols-2 gap-2" onClick={() => setMore(false)}>
          {[...NAV.slice(3), ...NAV_SECONDARY].filter((n) => !MOBILE.includes(n)).map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-2.5 rounded-2xl border border-line px-3 py-3 text-sm font-medium hover:bg-sunken">
              <n.icon className="h-5 w-5 text-pine" aria-hidden />
              {n.label}
            </Link>
          ))}
        </nav>
      </Modal>
    </div>
  );
}

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.93rem] font-medium transition", active ? "bg-pine-soft text-pine" : "text-ink-2 hover:bg-sunken hover:text-ink")}
    >
      <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
      {label}
    </Link>
  );
}
