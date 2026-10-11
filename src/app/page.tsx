import Link from "next/link";
import { ArrowRight, BellRing, CalendarClock, FileSearch, FileText, HeartHandshake, LineChart, Lock, MessageSquareText, Pill, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/buttonClass";
import { BRAND } from "@/lib/brand";

const FEATURES = [
  { icon: FileText, title: "One vault for every record", body: "Lab reports, prescriptions, discharge summaries, vaccinations and bills, organized by person, type and date. Originals are kept exactly as uploaded." },
  { icon: Sparkles, title: "Reports, explained plainly", body: "Understand each result with the lab’s own numbers, units and reference intervals, and see exactly which line supports every explanation." },
  { icon: LineChart, title: "Compare results over time", body: "See how a test changed across reports, only when the test and units are truly comparable. A trend is shown, never a diagnosis." },
  { icon: Pill, title: "Medicines you can rely on", body: "Turn a verified prescription into a clear daily schedule. Record taken, skipped or unconfirmed doses with a full history." },
  { icon: BellRing, title: "Reminders that are honest", body: "Server-side reminders with retries and no duplicates, and clear status when a notification could not be delivered." },
  { icon: CalendarClock, title: "Appointments and follow-ups", body: "Keep visits, lab tests and review dates with your questions, preparation notes and related records in one place." },
  { icon: MessageSquareText, title: "An assistant grounded in your records", body: "Ask about your saved information. Every answer points to its source, and says plainly what your records don’t show." },
  { icon: Users, title: "Family and caregivers", body: "Separate profiles for each person, with explicit, revocable sharing. Being family never grants access automatically." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/auth/sign-in" className={buttonClass("ghost", "sm")}>
            Sign in
          </Link>
          <Link href="/demo" className={buttonClass("primary", "sm")}>
            Try the demo
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div className="animate-rise">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-pine-soft px-3 py-1 text-sm font-medium text-pine">
              <ShieldCheck className="h-4 w-4" aria-hidden /> Private by default · You own your data
            </p>
            <h1 className="font-display text-[2.6rem] leading-[1.05] tracking-[-0.02em] sm:text-[3.6rem]">
              All your medical information, <em className="text-pine not-italic sm:italic">clearly organized.</em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
              {BRAND.name} brings your reports, prescriptions, medicines and appointments into one calm place, and helps you understand them in plain language.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className={buttonClass("primary", "lg")}>
                Explore with sample data <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/auth/sign-up" className={buttonClass("secondary", "lg")}>
                Create an account
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">The demo uses fictional people and records. Nothing you do there leaves your browser.</p>
          </div>

          <div aria-hidden className="relative animate-rise [animation-delay:120ms]">
            <div className="absolute -inset-2 sm:-inset-6 -z-10 rounded-[2.5rem] bg-pine-soft/70 blur-2xl" />
            <div className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
              <p className="text-sm text-muted">Good morning, Alex</p>
              <p className="font-display text-2xl">Today</p>
              <div className="mt-4 space-y-2.5">
                {[
                  ["7:00", "Levothyroxine 25 mcg", "1 tablet", "Taken", "ok"],
                  ["13:00", "Supplement 500 mg", "1 tablet", "Due now", "pine"],
                  ["21:00", "Supplement 500 mg", "1 tablet", "Upcoming", "neutral"],
                ].map(([t, n, d, s, tone]) => (
                  <div key={t} className="flex items-center gap-3 rounded-2xl border border-line bg-paper/60 px-3.5 py-3">
                    <span className="w-12 text-sm font-semibold tabular-nums text-ink-2">{t}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{n}</span>
                      <span className="block text-xs text-muted">{d}</span>
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone === "ok" ? "bg-ok-soft text-ok" : tone === "pine" ? "bg-pine-soft text-pine" : "bg-sunken text-ink-2"}`}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-warn-soft px-4 py-3 text-sm">
                <p className="font-semibold text-warn">1 value needs your review</p>
                <p className="text-ink-2">“Free T4 1.O ng/dL” – the letter O may be a zero. Please check it against your original report.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-3xl tracking-tight">Everything in one calm place</h2>
            <p className="mt-2 max-w-2xl text-ink-2">Simple first, detail when you want it. No meaningless health scores, no alarming dashboards.</p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <li key={f.title} className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
                  <f.icon className="h-6 w-6 text-pine" aria-hidden />
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl tracking-tight">Careful with what matters</h2>
            <p className="mt-3 text-ink-2">{BRAND.name} helps you organize and understand your information. It does not replace your doctor, pharmacist or emergency services.</p>
          </div>
          <ul className="space-y-4">
            {[
              [FileSearch, "Grounded in your documents", "Explanations use your report’s own values, units and intervals, and cite the line they came from. Missing information is called missing."],
              [HeartHandshake, "No treatment decisions", `${BRAND.name} never starts, stops or changes a medicine, and never guesses a dose or frequency from an unclear prescription.`],
              [Lock, "Security first", "Private storage, strict per-profile access, short-lived download links, audit logs, and no medical data used for advertising or AI training."],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof Lock;
              return (
                <li key={title as string} className="flex gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pine-soft text-pine">
                    <I className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-semibold">{title as string}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{body as string}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <Logo className="text-ink" />
          <p>Not a medical device. In an emergency, contact your local emergency number.</p>
        </div>
      </footer>
    </div>
  );
}
