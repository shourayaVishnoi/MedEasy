"use client";

import Link from "next/link";
import { AlertTriangle, CalendarPlus, Camera, Check, ClipboardList, FilePlus2, FileText, FlaskConical, History, Info, MapPin, MessageSquareText, Pill, PillBottle } from "lucide-react";
import { useNow, useWorkspace } from "@/lib/hooks";
import { occurrencesOn, occurrenceState } from "@/lib/meds/schedule";
import { DoseList } from "@/components/DoseList";
import { Badge, Button, ButtonLink, Card, Callout, EmptyState, LoadingPage, toast } from "@/components/ui";
import { Row, Tile } from "@/components/Rows";
import { logDose } from "@/lib/actions";
import { addDays, formatClock, formatDate, todayIn } from "@/lib/util";
import { relationToInterval } from "@/lib/reports/compare";

const QUICK = [
  { href: "/app/documents/upload", label: "Upload a report", sub: "PDF or photo", icon: FilePlus2, art: "from-[#e50914] to-[#5c0006]" },
  { href: "/app/documents/upload?type=prescription", label: "Add a prescription", sub: "Turn it into a schedule", icon: ClipboardList, art: "from-[#2f7cf6] to-[#0b1f4d]" },
  { href: "/app/medicines/new", label: "Add a medicine", sub: "Enter it yourself", icon: PillBottle, art: "from-[#1db954] to-[#06351a]" },
  { href: "/app/documents/upload?scan=1", label: "Scan a document", sub: "Use your camera", icon: Camera, art: "from-[#f5b301] to-[#4a3400]" },
  { href: "/app/assistant", label: "Ask about a report", sub: "Answers cite your records", icon: MessageSquareText, art: "from-[#8e44ec] to-[#2a0b52]" },
  { href: "/app/appointments?new=1", label: "Add an appointment", sub: "With your questions", icon: CalendarPlus, art: "from-[#ff6a3d] to-[#4d1405]" },
  { href: "/app/timeline", label: "View history", sub: "Everything, by date", icon: History, art: "from-[#14b8a6] to-[#053b35]" },
];

export default function Dashboard() {
  const ws = useWorkspace();
  const now = useNow();
  if (!ws) return <LoadingPage />;
  const { state, profileId, profile } = ws;
  const tz = state.settings.timezone;
  const today = todayIn(tz, now);
  const meds = state.medicines.filter((m) => m.profileId === profileId);
  const todays = occurrencesOn(meds, today);
  const logs = new Map(state.doseLogs.map((l) => [l.occurrenceKey, l]));
  const yesterdayUnrecorded = occurrencesOn(meds, addDays(today, -1)).filter((o) => occurrenceState(o, logs.get(o.key), now) === "not_recorded");
  const todayUnrecorded = todays.filter((o) => occurrenceState(o, logs.get(o.key), now) === "not_recorded");
  const docs = state.documents.filter((d) => d.profileId === profileId);
  const review = docs.filter((d) => d.status === "needs_review");
  const failed = docs.filter((d) => d.status === "failed");
  const draftRx = state.prescriptions.filter((p) => p.profileId === profileId && p.status === "draft");
  const upcomingAppts = state.appointments
    .filter((a) => a.profileId === profileId && a.status === "upcoming" && new Date(a.startsAt) >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 3);
  const latestLab = docs.filter((d) => d.category === "lab_report").sort((a, b) => (b.documentDate ?? "").localeCompare(a.documentDate ?? ""))[0];
  const latestObs = latestLab ? state.observations.filter((o) => o.documentId === latestLab.id) : [];
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = profile.relationship === "self" ? (profile.preferredName ?? state.settings.name) : undefined;
  const meds_ = new Map(meds.map((m) => [m.id, m]));
  const next = todays.find((o) => ["due", "not_recorded", "upcoming"].includes(occurrenceState(o, logs.get(o.key), now)));
  const nextMed = next ? meds_.get(next.medicineId) : undefined;
  const nextState = next ? occurrenceState(next, logs.get(next.key), now) : undefined;
  const takenCount = todays.filter((o) => logs.get(o.key)?.status === "taken").length;

  const pending = [
    ...review.map((d) => ({ key: d.id, text: `Review extracted details in “${d.title}”`, href: `/app/documents/${d.id}`, tone: "warn" as const })),
    ...draftRx.filter((p) => !review.some((d) => d.id === p.documentId)).map((p) => ({ key: p.id, text: `Verify prescription from ${p.prescriber ?? "unknown prescriber"}`, href: p.documentId ? `/app/documents/${p.documentId}` : "/app/medicines", tone: "warn" as const })),
    ...failed.map((d) => ({ key: d.id, text: `Text extraction failed for “${d.title}”. Your original is safe.`, href: `/app/documents/${d.id}`, tone: "danger" as const })),
    ...(yesterdayUnrecorded.length + todayUnrecorded.length > 0
      ? [{ key: "doses", text: `${yesterdayUnrecorded.length + todayUnrecorded.length} recent dose${yesterdayUnrecorded.length + todayUnrecorded.length > 1 ? "s have" : " has"} no record yet`, href: "/app/medicines?tab=history", tone: "warn" as const }]
      : []),
  ];

  return (
    <div>
      {/* Billboard */}
      <section className="relative -mx-4 -mt-20 mb-10 overflow-hidden px-4 pb-12 pt-28 sm:-mx-8 sm:px-8 lg:-mx-12 lg:-mt-24 lg:px-12 lg:pb-16 lg:pt-36">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(70rem_36rem_at_80%_10%,rgb(229_9_20/0.38),transparent_60%),radial-gradient(40rem_30rem_at_10%_90%,rgb(229_9_20/0.12),transparent_60%)]" />
          <div className="grid-bg absolute inset-0 opacity-60" />
          <p className="absolute -right-6 top-16 select-none font-brand text-[11rem] leading-none text-white/[0.04] sm:text-[16rem] lg:top-10 lg:text-[22rem]">TODAY</p>
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-paper to-transparent" />
        </div>
        <div className="max-w-2xl animate-rise">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-ink-2">
            <span className="font-brand text-xl leading-none tracking-normal text-pine">M</span>
            {new Intl.DateTimeFormat(state.settings.locale, { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now)}
          </p>
          <h1 className="text-glow mt-3 font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] sm:text-6xl">{name ? `${greeting}, ${name}` : `${profile.displayName}’s day`}</h1>
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.95rem] font-medium text-ink-2">
            {todays.length ? (
              <>
                <span className="font-bold text-ok">
                  {takenCount}/{todays.length} doses taken
                </span>
                <span aria-hidden className="text-muted">•</span>
              </>
            ) : null}
            <span>{todays.length ? `${todays.length} scheduled today` : "Nothing scheduled today"}</span>
            {upcomingAppts[0] && (
              <>
                <span aria-hidden className="text-muted">•</span>
                <span>Next visit {formatDate(upcomingAppts[0].startsAt, state.settings.locale, tz)}</span>
              </>
            )}
          </p>
          {todays.length > 0 && (
            <div className="mt-4 h-1 w-full max-w-sm overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Doses recorded as taken today" aria-valuemin={0} aria-valuemax={todays.length} aria-valuenow={takenCount}>
              <div className="h-full rounded-full bg-pine transition-[width] duration-700" style={{ width: `${(takenCount / todays.length) * 100}%` }} />
            </div>
          )}
          {next && nextMed ? (
            <div className="mt-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{nextState === "upcoming" ? "Up next" : nextState === "due" ? "Due now" : "Not recorded yet"} · {formatClock(next.time, state.settings.locale)}</p>
              <p className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {nextMed.name} {nextMed.strength && <span className="font-semibold text-ink-2">{nextMed.strength}</span>}
              </p>
              <p className="text-sm text-muted">{nextMed.dose}{nextMed.instructions ? ` · ${nextMed.instructions}` : ""}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="light" size="lg" onClick={() => { logDose(next, "taken"); toast(`${nextMed.name} recorded as taken`); }}>
                  <Check className="h-5 w-5 stroke-[3]" aria-hidden /> Mark as taken
                </Button>
                <ButtonLink href="/app/medicines" variant="secondary" size="lg">
                  <Info className="h-5 w-5" aria-hidden /> All medicines
                </ButtonLink>
              </div>
            </div>
          ) : (
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/app/documents/upload" variant="light" size="lg">
                <FilePlus2 className="h-5 w-5" aria-hidden /> Upload a report
              </ButtonLink>
              <ButtonLink href="/app/assistant" variant="secondary" size="lg">
                <MessageSquareText className="h-5 w-5" aria-hidden /> Ask the assistant
              </ButtonLink>
            </div>
          )}
        </div>
      </section>

      <div className="space-y-10">
        {pending.length > 0 && (
          <Row title="Continue where you left off" id="pending-h">
            <ul className="row-scroll">
              {pending.map((p, i) => (
                <li key={p.key}>
                  <Tile href={p.href} className="flex h-full flex-col">
                    <div className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${p.tone === "danger" ? "from-[#ff8a3d]/40 to-[#331a0b]" : i % 2 ? "from-[#f5b301]/35 to-[#2e2210]" : "from-[#e50914]/40 to-[#2a0a0c]"}`}>
                      {p.tone === "danger" ? <AlertTriangle className="h-10 w-10 text-danger" aria-hidden /> : <ClipboardList className="h-10 w-10 text-ink/90" aria-hidden />}
                      <span className="absolute left-2 top-2">
                        <Badge tone={p.tone}>{p.tone === "danger" ? "Failed" : "To review"}</Badge>
                      </span>
                    </div>
                    <div className="flex-1 px-3.5 py-3">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{p.text}</p>
                    </div>
                    <div className="h-1 bg-white/10" aria-hidden>
                      <div className="h-full w-1/3 bg-pine" />
                    </div>
                  </Tile>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Nothing here is urgent medical advice. These are records waiting for you to check.</p>
          </Row>
        )}

        <div className="grid grid-cols-1 gap-10 [&>*]:min-w-0 lg:grid-cols-[1.4fr_1fr] lg:gap-8">
          <Row title="Today’s medicines" href="/app/medicines" id="meds-h">
            <Card className="p-3 sm:p-4">
              {todays.length ? (
                <>
                  <DoseList state={state} occurrences={todays} now={now} compact />
                  <p className="mt-3 px-1 text-xs text-muted">Tap Taken when you take a dose. Unrecorded doses are never assumed taken or missed.</p>
                </>
              ) : (
                <EmptyState icon={<Pill className="h-6 w-6" />} title="No doses scheduled today" action={<ButtonLink href="/app/medicines/new" variant="quiet" size="sm">Add a medicine</ButtonLink>}>
                  Schedules are created only from details you confirm.
                </EmptyState>
              )}
            </Card>
          </Row>

          <Row title="Coming up" href="/app/appointments" id="appts-h">
            {upcomingAppts.length ? (
              <ol className="space-y-3">
                {upcomingAppts.map((a) => {
                  const d = new Date(a.startsAt);
                  return (
                    <li key={a.id}>
                      <Link href={`/app/appointments#appt-${a.id}`} className="tile flex items-stretch overflow-hidden rounded-md border border-line bg-surface">
                        <span className="flex w-20 shrink-0 flex-col items-center justify-center bg-gradient-to-b from-pine to-[#7a050b] py-3 text-white">
                          <span className="text-[0.65rem] font-bold uppercase tracking-widest">{d.toLocaleString(state.settings.locale, { month: "short", timeZone: tz })}</span>
                          <span className="font-brand text-4xl leading-none">{d.toLocaleString(state.settings.locale, { day: "numeric", timeZone: tz })}</span>
                          <span className="text-[0.65rem] font-semibold">{d.toLocaleString(state.settings.locale, { weekday: "short", timeZone: tz })}</span>
                        </span>
                        <span className="min-w-0 flex-1 px-4 py-3">
                          <span className="block text-xs font-bold tabular-nums text-accent">{d.toLocaleString(state.settings.locale, { hour: "numeric", minute: "2-digit", timeZone: tz })}</span>
                          <span className="block font-semibold leading-snug">{a.title}</span>
                          {a.location && (
                            <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{a.location}</span>
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Card className="px-5 py-8 text-center text-sm text-muted">No upcoming appointments.</Card>
            )}
          </Row>
        </div>

        <Row title={latestLab ? <>Latest results <span className="ml-1 text-sm font-medium text-muted">{latestLab.title}</span></> : "Latest results"} href={latestLab ? `/app/documents/${latestLab.id}` : undefined} linkLabel="Explain" id="labs-h">
          {latestObs.length ? (
            <ul className="row-scroll">
              {latestObs.map((o) => {
                const rel = relationToInterval(o);
                const unverified = o.verification === "extracted" && o.reviewReasons.length > 0;
                return (
                  <li key={o.id}>
                    <Tile href={`/app/documents/${latestLab!.id}`} width="w-[12.5rem] sm:w-[14rem]" className="flex h-full flex-col p-4">
                      <FlaskConical className="h-5 w-5 text-accent" aria-hidden />
                      <p className="mt-3 line-clamp-1 text-sm text-ink-2">{o.testName}</p>
                      <p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight">
                        {o.valueText} <span className="text-sm font-medium text-muted">{o.unit ?? "no unit"}</span>
                      </p>
                      <div className="mt-auto pt-3">
                        {unverified ? <Badge tone="warn">Needs review</Badge> : o.flag ? <Badge tone="neutral">Lab flag: {o.flag === "H" ? "High" : "Low"}</Badge> : rel === "within" ? <Badge tone="neutral" icon={false}>Within lab interval</Badge> : rel === "unknown" ? <Badge tone="neutral" icon={false}>No interval printed</Badge> : <Badge tone="neutral">Outside interval</Badge>}
                      </div>
                    </Tile>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Card>
              <EmptyState icon={<FileText className="h-6 w-6" />} title="No lab reports yet" action={<ButtonLink href="/app/documents/upload" variant="quiet" size="sm">Upload a report</ButtonLink>} />
            </Card>
          )}
        </Row>

        <Row title="Start something new" id="quick-h">
          <ul className="row-scroll">
            {QUICK.map((q) => (
              <li key={q.href}>
                <Tile href={q.href} width="w-[10.5rem] sm:w-[12rem]" className={`flex aspect-[2/3] flex-col justify-between border-transparent bg-gradient-to-b p-4 ${q.art}`}>
                  <q.icon className="h-9 w-9 text-white drop-shadow" aria-hidden />
                  <span>
                    <span className="block font-display text-lg font-bold leading-tight text-white">{q.label}</span>
                    <span className="mt-1 block text-xs font-medium text-white/75">{q.sub}</span>
                  </span>
                </Tile>
              </li>
            ))}
          </ul>
        </Row>

        <Row title="Recent activity" href="/app/timeline" linkLabel="Timeline" id="activity-h">
          <Card>
            <ul className="divide-y divide-line text-sm">
              {state.audit.slice(0, 6).map((a) => (
                <li key={a.id} className="flex justify-between gap-3 px-4 py-3">
                  <span className="text-ink-2">{a.detail}</span>
                  <time className="shrink-0 text-xs tabular-nums text-muted" dateTime={a.at}>
                    {new Date(a.at).toLocaleString(state.settings.locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </time>
                </li>
              ))}
            </ul>
          </Card>
        </Row>

        <Callout tone="neutral">
          MedEasy organizes and explains your records. It is not a diagnosis tool and doesn’t replace your clinician. In an emergency, contact your local emergency number.
        </Callout>
      </div>
    </div>
  );
}
