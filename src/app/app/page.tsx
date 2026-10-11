"use client";

import Link from "next/link";
import { ArrowRight, CalendarPlus, Camera, ClipboardList, FilePlus2, FileText, FlaskConical, History, MessageSquareText, Pill, PillBottle } from "lucide-react";
import { useNow, useWorkspace } from "@/lib/hooks";
import { occurrencesOn, occurrenceState } from "@/lib/meds/schedule";
import { DoseList } from "@/components/DoseList";
import { Badge, ButtonLink, Card, CardHeader, Callout, EmptyState, LoadingPage, PageHeader } from "@/components/ui";
import { addDays, formatDate, todayIn } from "@/lib/util";
import { relationToInterval } from "@/lib/reports/compare";

const QUICK = [
  { href: "/app/documents/upload", label: "Upload a report", icon: FilePlus2 },
  { href: "/app/documents/upload?type=prescription", label: "Add a prescription", icon: ClipboardList },
  { href: "/app/medicines/new", label: "Add a medicine", icon: PillBottle },
  { href: "/app/documents/upload?scan=1", label: "Scan a document", icon: Camera },
  { href: "/app/assistant", label: "Ask about a report", icon: MessageSquareText },
  { href: "/app/timeline", label: "View history", icon: History },
  { href: "/app/appointments?new=1", label: "Add appointment", icon: CalendarPlus },
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
      <PageHeader
        eyebrow={new Intl.DateTimeFormat(state.settings.locale, { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now)}
        title={name ? `${greeting}, ${name}` : `${profile.displayName}’s day`}
        subtitle={todays.length ? `${todays.length} scheduled dose${todays.length > 1 ? "s" : ""} today${upcomingAppts[0] ? ` · next appointment ${formatDate(upcomingAppts[0].startsAt, state.settings.locale, tz)}` : ""}.` : "Nothing scheduled today."}
      />

      {pending.length > 0 && (
        <Card className="mb-6 animate-rise border-warn/25" as="section" aria-labelledby="pending-h">
          <CardHeader title={<span id="pending-h">Needs your attention</span>} subtitle="Nothing here is urgent medical advice. These are records waiting for you." icon={<ClipboardList className="h-5 w-5" />} />
          <ul className="mt-3 divide-y divide-line px-2 pb-2">
            {pending.map((p) => (
              <li key={p.key}>
                <Link href={p.href} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-sunken">
                  <span className="flex items-center gap-2.5 text-sm">
                    <Badge tone={p.tone}>{p.tone === "danger" ? "Failed" : "To review"}</Badge>
                    {p.text}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <Card className="animate-rise">
            <CardHeader title="Today’s medicines" subtitle="Tap Taken when you take a dose. Unrecorded doses are never assumed taken or missed." icon={<Pill className="h-5 w-5" />} action={<ButtonLink href="/app/medicines" variant="ghost" size="sm">All</ButtonLink>} />
            <div className="p-4 pt-4">
              {todays.length ? (
                <DoseList state={state} occurrences={todays} now={now} compact />
              ) : (
                <EmptyState icon={<Pill className="h-6 w-6" />} title="No doses scheduled today" action={<ButtonLink href="/app/medicines/new" variant="quiet" size="sm">Add a medicine</ButtonLink>}>
                  Schedules are created only from details you confirm.
                </EmptyState>
              )}
            </div>
          </Card>

          <Card className="animate-rise">
            <CardHeader
              title="Latest lab results"
              subtitle={latestLab ? `${latestLab.title} · ${formatDate(latestLab.documentDate, state.settings.locale)}` : undefined}
              icon={<FlaskConical className="h-5 w-5" />}
              action={latestLab && <ButtonLink href={`/app/documents/${latestLab.id}`} variant="ghost" size="sm">Explain</ButtonLink>}
            />
            <div className="p-4">
              {latestObs.length ? (
                <ul className="grid grid-cols-1 gap-2 [&>*]:min-w-0 sm:grid-cols-2">
                  {latestObs.slice(0, 6).map((o) => {
                    const rel = relationToInterval(o);
                    const unverified = o.verification === "extracted" && o.reviewReasons.length > 0;
                    return (
                      <li key={o.id} className="rounded-2xl border border-line px-3.5 py-3">
                        <p className="text-sm text-muted">{o.testName}</p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums">
                          {o.valueText} <span className="text-sm font-normal text-muted">{o.unit ?? "no unit"}</span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {unverified ? <Badge tone="warn">Needs review</Badge> : o.flag ? <Badge tone="neutral">Lab flag: {o.flag === "H" ? "High" : "Low"}</Badge> : rel === "within" ? <Badge tone="neutral" icon={false}>Within lab interval</Badge> : rel === "unknown" ? <Badge tone="neutral" icon={false}>No interval printed</Badge> : <Badge tone="neutral">Outside interval</Badge>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={<FileText className="h-6 w-6" />} title="No lab reports yet" action={<ButtonLink href="/app/documents/upload" variant="quiet" size="sm">Upload a report</ButtonLink>} />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="animate-rise">
            <CardHeader title="Quick actions" />
            <ul className="grid grid-cols-2 gap-2 p-4">
              {QUICK.map((q) => (
                <li key={q.href}>
                  <Link href={q.href} className="flex h-full min-h-14 items-center gap-2.5 rounded-2xl border border-line px-3 py-2.5 text-sm font-medium transition hover:border-pine/40 hover:bg-pine-soft/40">
                    <q.icon className="h-5 w-5 shrink-0 text-pine" aria-hidden />
                    {q.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="animate-rise">
            <CardHeader title="Coming up" icon={<CalendarPlus className="h-5 w-5" />} action={<ButtonLink href="/app/appointments" variant="ghost" size="sm">All</ButtonLink>} />
            <div className="p-4">
              {upcomingAppts.length ? (
                <ol className="relative space-y-4 border-l border-line pl-5">
                  {upcomingAppts.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-surface bg-pine" aria-hidden />
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        {new Date(a.startsAt).toLocaleString(state.settings.locale, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz })}
                      </p>
                      <Link href={`/app/appointments#appt-${a.id}`} className="font-medium hover:underline">
                        {a.title}
                      </Link>
                      {a.location && <p className="text-sm text-muted">{a.location}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">No upcoming appointments.</p>
              )}
            </div>
          </Card>

          <Card className="animate-rise">
            <CardHeader title="Recent activity" icon={<History className="h-5 w-5" />} />
            <ul className="space-y-2.5 p-5 pt-4 text-sm">
              {state.audit.slice(0, 6).map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="text-ink-2">{a.detail}</span>
                  <time className="shrink-0 text-xs text-muted" dateTime={a.at}>
                    {new Date(a.at).toLocaleString(state.settings.locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </time>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Callout tone="neutral" className="mt-8">
        HealthOS organizes and explains your records. It is not a diagnosis tool and doesn’t replace your clinician. In an emergency, contact your local emergency number.
      </Callout>
    </div>
  );
}
