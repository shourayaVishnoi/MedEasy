"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
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
import type { Profile } from "@/lib/types";
import { cx } from "@/lib/util";

const NAV = [
  { href: "/app", label: "Today", icon: Home },
  { href: "/app/documents", label: "Records", icon: FileText },
  { href: "/app/medicines", label: "Medicines", icon: Pill },
  { href: "/app/appointments", label: "Appointments", icon: CalendarDays },
  { href: "/app/compare", label: "Compare", icon: LineChart },
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

/** Profile tile colours, picked by position like streaming-app profiles. */
const AVATAR = ["bg-[#e50914]", "bg-[#2f7cf6]", "bg-[#f5b301] text-black", "bg-[#1db954] text-black", "bg-[#8e44ec]"];

export function Avatar({ profile, index, className }: { profile: Profile; index: number; className?: string }) {
  return (
    <span aria-hidden className={cx("grid shrink-0 place-items-center rounded-md font-display font-bold text-white", AVATAR[index % AVATAR.length], className ?? "h-8 w-8 text-sm")}>
      {profile.displayName.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

function isActive(path: string, href: string) {
  return href === "/app" ? path === "/app" : path.startsWith(href);
}

export function AppShell({ ws, children }: { ws: Workspace; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [solid, setSolid] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);
  useEffect(() => {
    setMenu(false);
  }, [path]);
  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const profiles = ws.state.profiles;
  const activeIndex = Math.max(0, profiles.findIndex((p) => p.id === ws.profileId));
  const switchTo = (id: string) => update((s) => ({ ...s, activeProfileId: id }), { action: "profile.switched", detail: "Active profile changed" });

  return (
    <div className="min-h-dvh">
      <header className={cx("no-print fixed inset-x-0 top-0 z-30 transition-colors duration-300", solid ? "bg-black/95 shadow-[0_1px_0_rgb(255_255_255/0.06)] backdrop-blur" : "bg-gradient-to-b from-black/90 via-black/50 to-transparent")}>
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-8 lg:h-[4.25rem] lg:gap-8 lg:px-12">
          <Link href="/app" aria-label="Today">
            <span className="hidden sm:inline">
              <Logo />
            </span>
            <span className="sm:hidden">
              <Logo compact />
            </span>
          </Link>
          <nav aria-label="Main" className="hidden min-w-0 items-center gap-5 xl:flex">
            {NAV.slice(0, 7).map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined} className={cx("whitespace-nowrap text-sm transition", isActive(path, n.href) ? "font-bold text-ink" : "text-ink-2 hover:text-muted")}>
                {n.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Main" className="hidden items-center gap-5 lg:flex xl:hidden">
            {NAV.slice(0, 4).map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(path, n.href) ? "page" : undefined} className={cx("whitespace-nowrap text-sm transition", isActive(path, n.href) ? "font-bold text-ink" : "text-ink-2 hover:text-muted")}>
                {n.label}
              </Link>
            ))}
            <button onClick={() => setMore(true)} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-muted">
              More <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-3 sm:gap-4">
            <form
              role="search"
              className={cx("flex items-center rounded-sm border transition-all", searching ? "w-48 border-white/70 bg-black/80 sm:w-64" : "w-9 border-transparent")}
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/app/search?q=${encodeURIComponent(q)}`);
              }}
            >
              <button type={searching ? "submit" : "button"} onClick={() => !searching && setSearching(true)} className="grid h-9 w-9 shrink-0 place-items-center text-ink" aria-label="Search all records">
                <Search className="h-5 w-5" aria-hidden />
              </button>
              {searching && (
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onBlur={() => !q && setSearching(false)}
                  placeholder="Tests, medicines, doctors"
                  aria-label="Search all records"
                  className="h-9 min-w-0 flex-1 bg-transparent pr-2 text-sm text-ink placeholder:text-muted focus:outline-none"
                />
              )}
            </form>
            {ws.state.mode === "demo" ? (
              <Link href="/app/privacy#demo" className="hidden items-center gap-1 rounded-sm border border-gold/40 bg-gold/10 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-gold md:inline-flex">
                <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Demo
              </Link>
            ) : (
              <span className="hidden md:inline-flex">
                <SyncStatus compact />
              </span>
            )}
            <div ref={menuRef} className="relative">
              <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" className="group flex items-center gap-1.5" aria-label={`Viewing ${profiles[activeIndex]?.displayName}. Switch profile or open settings`}>
                <Avatar profile={profiles[activeIndex]} index={activeIndex} />
                <ChevronDown className={cx("hidden h-4 w-4 text-ink transition-transform sm:block", menu && "rotate-180")} aria-hidden />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 top-12 w-64 animate-rise rounded-md border border-white/15 bg-black/95 py-2 shadow-2xl backdrop-blur">
                  <p className="px-4 pb-1 pt-1 text-[0.7rem] font-bold uppercase tracking-wider text-muted">Viewing records for</p>
                  {profiles.map((p, i) => (
                    <button key={p.id} role="menuitemradio" aria-checked={p.id === ws.profileId} onClick={() => { switchTo(p.id); setMenu(false); }} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-white/10">
                      <Avatar profile={p} index={i} className="h-7 w-7 text-xs" />
                      <span className="min-w-0 flex-1 truncate">
                        {p.displayName}
                        {p.relationship !== "self" && <span className="text-muted"> · {p.relationship}</span>}
                      </span>
                      {p.id === ws.profileId && <Check className="h-4 w-4 text-ink" aria-hidden />}
                    </button>
                  ))}
                  <div className="my-2 border-t border-white/10" />
                  {NAV_SECONDARY.map((n) => (
                    <Link key={n.href} role="menuitem" href={n.href} className="flex items-center gap-3 px-4 py-2 text-sm text-ink-2 hover:bg-white/10 hover:text-ink">
                      <n.icon className="h-4 w-4" aria-hidden />
                      {n.label}
                    </Link>
                  ))}
                  {ws.state.mode === "cloud" && (
                    <div className="mt-2 border-t border-white/10 px-4 pt-3">
                      <SyncStatus />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1440px] px-4 pb-28 pt-20 sm:px-8 lg:px-12 lg:pb-16 lg:pt-24">
        {ws.state.mode === "cloud" && <SyncErrorBanner />}
        {children}
      </main>

      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {MOBILE.map((n) => {
            const on = isActive(path, n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={on ? "page" : undefined} className={cx("flex h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold", on ? "text-ink" : "text-muted")}>
                  <n.icon className={cx("h-[1.35rem] w-[1.35rem]", on && "stroke-[2.5]")} aria-hidden />
                  {n.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMore(true)} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold text-muted">
              <Menu className="h-[1.35rem] w-[1.35rem]" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="More">
        <nav aria-label="More" className="grid grid-cols-2 gap-2" onClick={() => setMore(false)}>
          {[...NAV.slice(3), ...NAV_SECONDARY].filter((n) => !MOBILE.includes(n)).map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-2.5 rounded-md border border-line bg-raised px-3 py-3 text-sm font-semibold hover:border-white/30">
              <n.icon className="h-5 w-5 text-accent" aria-hidden />
              {n.label}
            </Link>
          ))}
        </nav>
      </Modal>
    </div>
  );
}

