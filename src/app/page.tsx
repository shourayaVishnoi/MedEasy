import Link from "next/link";
import { ChevronRight, BellRing, CalendarClock, FileSearch, FileText, HeartHandshake, LineChart, Lock, MessageSquareText, Pill, Plus, Sparkles, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/buttonClass";
import { BRAND } from "@/lib/brand";


const POSTERS = [
  ["Thyroid panel", "Lab report", "from-[#e50914] to-[#3d0003]", FileText],
  ["Morning meds", "3 doses", "from-[#2f7cf6] to-[#0b1f4d]", Pill],
  ["Follow-up visit", "Fri 10:30", "from-[#f5b301] to-[#3b2a00]", CalendarClock],
  ["HbA1c trend", "4 reports", "from-[#1db954] to-[#06351a]", LineChart],
  ["Ask anything", "Cited answers", "from-[#8e44ec] to-[#24094a]", MessageSquareText],
  ["Family", "3 profiles", "from-[#ff6a3d] to-[#4d1405]", Users],
  ["Blood count", "Lab report", "from-[#14b8a6] to-[#053b35]", FileText],
  ["Reminders", "On time", "from-[#e50914] to-[#3d0003]", BellRing],
  ["Explained", "Plain words", "from-[#f43f5e] to-[#4c0519]", Sparkles],
] as const;

const FAQ = [
  ["What is MedEasy?", "MedEasy keeps your reports, prescriptions, medicines and appointments in one place, and explains them in plain language using only what your documents say."],
  ["Does it diagnose me or change my medicines?", "No. MedEasy never diagnoses, never starts, stops or changes a medicine, and never guesses a dose from an unclear prescription. It points you back to your clinician."],
  ["Who can see my records?", "Only you, and anyone you explicitly invite. Every share link can be limited to chosen records, set to expire, and revoked at any time."],
  ["Can I try it without signing up?", "Yes. The demo uses fictional people and records, and nothing you do there leaves your browser."],
  ["Is it free?", "Yes, to try. Create an account to keep your own records in sync across your devices."],
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-black">
      <section className="relative isolate min-h-[42rem] overflow-hidden sm:min-h-[46rem]">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 grid w-[150%] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] grid-cols-3 gap-3 opacity-55 sm:w-[120%] sm:grid-cols-5 lg:grid-cols-6">
            {[...POSTERS, ...POSTERS, ...POSTERS, ...POSTERS].map(([t, sub, art, Icon], i) => (
              <div key={i} className={`flex aspect-[2/3] flex-col justify-between rounded-md bg-gradient-to-b p-4 ${art}`}>
                <Icon className="h-8 w-8 text-white/90" />
                <div>
                  <p className="font-display text-lg font-bold leading-tight text-white">{t}</p>
                  <p className="text-xs text-white/70">{sub}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(0_0_0/0.55),rgb(0_0_0/0.92)_70%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black" />
        </div>

        <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8 lg:px-12">
          <Logo className="text-[2.4rem] sm:text-[2.8rem]" />
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/demo" className={`${buttonClass("secondary", "sm")} hidden sm:inline-flex`}>
              Try the demo
            </Link>
            <Link href="/auth/sign-in" className={buttonClass("primary", "sm")}>
              Sign in
            </Link>
          </nav>
        </header>

        <main id="main" className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-24 pt-20 text-center sm:pt-28">
          <h1 className="text-glow animate-rise font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.035em] sm:text-[4.25rem]">
            Unlimited records.
            <br />
            Zero chaos.
          </h1>
          <p className="mt-5 animate-rise text-lg font-medium text-ink sm:text-2xl [animation-delay:80ms]">Reports, prescriptions, medicines and visits, explained in plain words.</p>
          <p className="mt-8 animate-rise text-base text-ink-2 sm:text-lg [animation-delay:160ms]">Ready to see it? Jump into the demo with sample data. No sign-up needed.</p>
          <div className="mt-4 flex w-full animate-rise flex-col justify-center gap-3 sm:flex-row [animation-delay:200ms]">
            <Link href="/demo" className={`${buttonClass("primary", "lg")} h-14 px-8 text-xl`}>
              Explore the demo <ChevronRight className="h-6 w-6" aria-hidden />
            </Link>
            <Link href="/auth/sign-up" className={`${buttonClass("secondary", "lg")} h-14 px-8 text-lg`}>
              Create an account
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">The demo uses fictional people and records. Nothing you do there leaves your browser.</p>
        </main>
      </section>

      {[
        {
          title: "Your reports, finally readable.",
          body: "Every result is explained with the lab’s own numbers, units and reference intervals, and you can see the exact line each explanation came from.",
          art: (
            <div className="rounded-xl border border-white/10 bg-surface p-5 text-left shadow-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Thyroid panel · 12 Sep</p>
              {[["TSH", "2.2", "mIU/L", "Within lab interval"], ["Free T4", "1.0", "ng/dL", "Needs review"], ["Haemoglobin", "13.4", "g/dL", "Within lab interval"]].map(([n, v, u, b]) => (
                <div key={n} className="mt-3 flex items-center justify-between gap-3 rounded-md bg-raised px-4 py-3">
                  <span className="text-sm text-ink-2">{n}</span>
                  <span className="font-display text-2xl font-bold tabular-nums">{v} <span className="text-xs font-medium text-muted">{u}</span></span>
                  <span className={`hidden rounded px-2 py-0.5 text-xs font-semibold sm:inline ${b === "Needs review" ? "bg-warn-soft text-warn" : "bg-white/[0.06] text-ink-2"}`}>{b}</span>
                </div>
              ))}
            </div>
          ),
        },
        {
          title: "Never miss a dose.",
          body: "Turn a verified prescription into a daily schedule, get reminders on your phone, and keep an honest record of what was taken, skipped or not sure.",
          art: (
            <div className="rounded-xl border border-white/10 bg-surface p-5 text-left shadow-2xl">
              {[["7:00", "Levothyroxine 25 mcg", "Taken", "bg-ok-soft text-ok"], ["13:00", "Supplement 500 mg", "Due now", "bg-pine text-white"], ["21:00", "Supplement 500 mg", "Upcoming", "bg-white/[0.06] text-ink-2"]].map(([t, n, s, c]) => (
                <div key={t} className="mt-3 flex items-center gap-3 rounded-md bg-raised px-4 py-3 first:mt-0">
                  <span className="w-12 font-display text-sm font-bold tabular-nums text-ink-2">{t}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{n}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${c}`}>{s}</span>
                </div>
              ))}
            </div>
          ),
        },
        {
          title: "Made for the whole family.",
          body: "A separate profile for everyone you care for, with sharing you control. Being family never grants access automatically.",
          art: (
            <div className="flex flex-wrap justify-center gap-5 sm:gap-7">
              {[["A", "Alex", "bg-[#e50914]"], ["M", "Mum", "bg-[#2f7cf6]"], ["S", "Sam", "bg-[#f5b301] text-black"], ["+", "Add", "border-2 border-white/30 text-muted"]].map(([l, n, c]) => (
                <div key={n} className="text-center">
                  <div className={`tile grid h-24 w-24 place-items-center rounded-md font-display text-4xl font-bold text-white sm:h-28 sm:w-28 ${c}`}>{l === "+" ? <Plus className="h-10 w-10" /> : l}</div>
                  <p className="mt-2 text-sm text-muted">{n}</p>
                </div>
              ))}
            </div>
          ),
        },
        {
          title: "Careful with what matters.",
          body: "Answers are grounded in your own documents and cite their source. Private storage, strict access, audit logs, and no medical data used for ads.",
          art: (
            <ul className="space-y-4 text-left">
              {[[FileSearch, "Grounded in your documents"], [HeartHandshake, "Never decides your treatment"], [Lock, "Private by default"]].map(([Icon, t]) => {
                const I = Icon as typeof Lock;
                return (
                  <li key={t as string} className="flex items-center gap-4 rounded-md bg-surface px-5 py-4">
                    <I className="h-6 w-6 text-accent" aria-hidden />
                    <span className="font-display text-lg font-semibold">{t as string}</span>
                  </li>
                );
              })}
            </ul>
          ),
        },
      ].map((f, i) => (
        <section key={f.title} className="border-t-8 border-[#232323]">
          <div className={`mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:gap-16`}>
            <div className={`text-center lg:text-left ${i % 2 ? "lg:order-2" : ""}`}>
              <h2 className="font-display text-[2rem] font-bold leading-tight tracking-tight sm:text-5xl">{f.title}</h2>
              <p className="mt-4 text-lg text-ink-2 sm:text-xl">{f.body}</p>
            </div>
            <div className="min-w-0">{f.art}</div>
          </div>
        </section>
      ))}

      <section className="border-t-8 border-[#232323]">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8 sm:py-20">
          <h2 className="text-center font-display text-[2rem] font-bold tracking-tight sm:text-5xl">Frequently asked questions</h2>
          <div className="mt-8 space-y-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group bg-raised">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-lg font-medium hover:bg-[#2d2d2d] sm:text-2xl [&::-webkit-details-marker]:hidden">
                  {q}
                  <Plus className="h-7 w-7 shrink-0 transition-transform group-open:rotate-45" aria-hidden />
                </summary>
                <p className="border-t border-black px-6 py-5 text-base leading-relaxed text-ink-2 sm:text-xl">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-10 text-center text-lg text-ink-2">Ready to see it in action?</p>
          <div className="mt-4 flex justify-center">
            <Link href="/demo" className={`${buttonClass("primary", "lg")} h-14 px-8 text-xl`}>
              Get started <ChevronRight className="h-6 w-6" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t-8 border-[#232323]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo className="text-2xl" />
          <p>{BRAND.name} is not a medical device. In an emergency, contact your local emergency number.</p>
        </div>
      </footer>
    </div>
  );
}
