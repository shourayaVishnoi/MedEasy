"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellRing, ChevronLeft, ChevronRight, Pause, Pill, Play, Plus, ShieldAlert, Square, Trash2 } from "lucide-react";
import { useNow, useWorkspace } from "@/lib/hooks";
import { occurrencesBetween, occurrencesOn, occurrenceState, STATE_LABEL } from "@/lib/meds/schedule";
import { deleteMedicine, setMedicineStatus } from "@/lib/actions";
import { DoseList } from "@/components/DoseList";
import { Badge, Button, ButtonLink, Callout, Card, ConfirmDialog, EmptyState, LoadingPage, PageHeader, Segmented, toast, type Tone } from "@/components/ui";
import { addDays, formatClock, formatDate, todayIn } from "@/lib/util";
import type { Medicine } from "@/lib/types";

type Tab = "today" | "list" | "history" | "reminders";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MedicinesPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <Medicines />
    </Suspense>
  );
}

function Medicines() {
  const ws = useWorkspace();
  const now = useNow();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "today");
  const [offset, setOffset] = useState(0);
  const [toDelete, setToDelete] = useState<Medicine | null>(null);
  if (!ws) return <LoadingPage />;
  const { state, profileId } = ws;
  const tz = state.settings.timezone;
  const meds = state.medicines.filter((m) => m.profileId === profileId);
  const day = addDays(todayIn(tz, now), offset);
  const occ = occurrencesOn(meds, day);

  return (
    <div>
      <PageHeader
        title="Medicines"
        subtitle="Schedules come only from details you’ve confirmed. HealthOS never starts, stops or changes a medicine."
        actions={
          <>
            <ButtonLink href="/app/documents/upload?type=prescription" variant="secondary">
              Add prescription
            </ButtonLink>
            <ButtonLink href="/app/medicines/new">
              <Plus className="h-4 w-4" aria-hidden /> Add medicine
            </ButtonLink>
          </>
        }
      />
      <div className="mb-5 overflow-x-auto">
        <Segmented
          label="Medicine views"
          value={tab}
          onChange={setTab}
          options={[
            { value: "today", label: "Schedule" },
            { value: "list", label: `My medicines (${meds.length})` },
            { value: "history", label: "History" },
            { value: "reminders", label: "Reminders" },
          ]}
        />
      </div>

      {tab === "today" && (
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOffset((o) => o - 1)} aria-label="Previous day">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <p className="font-semibold">{offset === 0 ? "Today" : offset === -1 ? "Yesterday" : offset === 1 ? "Tomorrow" : formatDate(day, state.settings.locale)}</p>
              <p className="text-xs text-muted">{formatDate(day, state.settings.locale)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOffset((o) => o + 1)} aria-label="Next day">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          {occ.length ? (
            <DoseList state={state} occurrences={occ} now={now} />
          ) : (
            <EmptyState icon={<Pill className="h-6 w-6" />} title="No scheduled doses on this day" />
          )}
        </Card>
      )}

      {tab === "list" && (
        <div className="space-y-3">
          {meds.length === 0 && (
            <Card>
              <EmptyState icon={<Pill className="h-6 w-6" />} title="No medicines yet" action={<ButtonLink href="/app/medicines/new">Add a medicine</ButtonLink>}>
                Add one manually, or verify a prescription to create a schedule.
              </EmptyState>
            </Card>
          )}
          {meds.map((m) => {
            const rx = state.prescriptions.find((p) => p.id === m.prescriptionId);
            const tone: Tone = m.status === "active" ? "ok" : m.status === "paused" ? "warn" : "neutral";
            return (
              <Card key={m.id} id={`med-${m.id}`} as="article" className="scroll-mt-24 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {m.name} {m.strength && <span className="font-normal text-muted">{m.strength}</span>}
                    </h2>
                    <p className="text-sm text-ink-2">
                      {m.dose}
                      {m.route ? ` · ${m.route}` : ""}
                      {m.frequencyText ? ` · ${m.frequencyText}` : ""}
                    </p>
                  </div>
                  <Badge tone={tone}>{m.status[0].toUpperCase() + m.status.slice(1)}</Badge>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Schedule</dt>
                    <dd>
                      {m.schedule.times.length ? m.schedule.times.map((t) => formatClock(t, state.settings.locale)).join(", ") : "As needed – no reminders"}
                      {m.schedule.times.length > 0 && ` · ${m.schedule.weekdays.length ? m.schedule.weekdays.map((d) => DAYS[d]).join(", ") : "every day"}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Dates</dt>
                    <dd>
                      From {formatDate(m.schedule.startDate, state.settings.locale)}
                      {m.schedule.endDate ? ` to ${formatDate(m.schedule.endDate, state.settings.locale)}` : " · no end date"}
                    </dd>
                  </div>
                  {m.instructions && (
                    <div>
                      <dt className="text-muted">Instructions</dt>
                      <dd>{m.instructions}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted">Source</dt>
                    <dd>
                      {rx?.documentId ? (
                        <Link href={`/app/documents/${rx.documentId}`} className="text-pine underline underline-offset-2">
                          Prescription{rx.prescriber ? ` from ${rx.prescriber}` : ""}
                        </Link>
                      ) : (
                        "Entered manually"
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                  {m.status === "active" ? (
                    <Button size="sm" variant="secondary" onClick={() => { setMedicineStatus(m.id, "paused"); toast(`${m.name} reminders paused`); }}>
                      <Pause className="h-4 w-4" aria-hidden /> Pause reminders
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => { setMedicineStatus(m.id, "active"); toast(`${m.name} marked active`); }}>
                      <Play className="h-4 w-4" aria-hidden /> Mark active
                    </Button>
                  )}
                  {m.status !== "completed" && (
                    <Button size="sm" variant="ghost" onClick={() => { setMedicineStatus(m.id, "completed"); toast(`${m.name} marked completed`); }}>
                      <Square className="h-4 w-4" aria-hidden /> Mark completed
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(m)} aria-label={`Remove ${m.name}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted">Status changes record what you’ve been told by your clinician. They don’t change the prescription.</p>
              </Card>
            );
          })}
          <Callout tone="neutral" title="Medication safety checks: not available">
            <span className="inline-flex items-start gap-1.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Interaction and duplicate-ingredient checks need a licensed drug-information source, and none is configured. No checks have been run, so the absence of warnings here doesn’t mean a combination is safe. Ask your pharmacist to review your full medicine list.
            </span>
          </Callout>
        </div>
      )}

      {tab === "history" && <History />}
      {tab === "reminders" && <Reminders />}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        danger
        title={`Remove ${toDelete?.name}?`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (toDelete) deleteMedicine(toDelete.id);
          toast("Medicine removed");
        }}
      >
        This removes the medicine and its future reminders from HealthOS. Your past dose history is kept. It doesn’t change your prescription. Only stop a medicine on your clinician’s advice.
      </ConfirmDialog>
    </div>
  );

  function History() {
    const from = addDays(todayIn(tz, now), -13);
    const all = occurrencesBetween(state.medicines.filter((m) => m.profileId === profileId), from, todayIn(tz, now)).filter((o) => o.scheduledFor <= now);
    const logs = new Map(state.doseLogs.map((l) => [l.occurrenceKey, l]));
    const orphanLogs = state.doseLogs.filter((l) => l.profileId === profileId && !all.some((o) => o.key === l.occurrenceKey) && l.scheduledFor >= `${from}T00:00`);
    const rows = [
      ...all.map((o) => ({ key: o.key, medicineId: o.medicineId, scheduled: o.scheduledFor, st: occurrenceState(o, logs.get(o.key), now), log: logs.get(o.key) })),
      ...orphanLogs.map((l) => ({ key: l.occurrenceKey, medicineId: l.medicineId, scheduled: new Date(l.scheduledFor), st: l.status, log: l })),
    ].sort((a, b) => b.scheduled.getTime() - a.scheduled.getTime());
    const name = (id: string) => state.medicines.find((m) => m.id === id)?.name ?? "Removed medicine";
    const TONE: Record<string, Tone> = { taken: "ok", skipped: "info", unconfirmed: "warn", not_recorded: "warn", due: "pine", upcoming: "neutral" };
    return (
      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold">Last 14 days</h2>
          <p className="text-sm text-muted">“Not recorded” means no one logged this dose. HealthOS doesn’t assume it was taken or missed.</p>
        </div>
        {rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">No dose history yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{name(r.medicineId)}</p>
                  <p className="text-muted">
                    Scheduled {r.scheduled.toLocaleString(state.settings.locale, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz })}
                    {r.log?.takenAt && ` · taken ${new Date(r.log.takenAt).toLocaleTimeString(state.settings.locale, { hour: "numeric", minute: "2-digit", timeZone: tz })}`}
                    {r.log?.recordedAt && ` · recorded ${new Date(r.log.recordedAt).toLocaleString(state.settings.locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: tz })}`}
                  </p>
                  {r.log?.note && <p className="text-ink-2">Note: {r.log.note}</p>}
                </div>
                <Badge tone={TONE[r.st]}>{STATE_LABEL[r.st]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }
}

function Reminders() {
  const ws = useWorkspace()!;
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const s = ws.state.settings;
  return (
    <div className="grid grid-cols-1 [&>*]:min-w-0 gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <BellRing className="h-5 w-5 text-pine" aria-hidden /> Browser notifications
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          Status:{" "}
          <Badge tone={perm === "granted" ? "ok" : perm === "denied" ? "danger" : "warn"}>
            {perm === "granted" ? "Allowed" : perm === "denied" ? "Blocked in browser settings" : perm === "unsupported" ? "Not supported here" : "Not yet allowed"}
          </Badge>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {perm === "default" && (
            <Button size="sm" onClick={async () => setPerm(await Notification.requestPermission())}>
              Allow notifications
            </Button>
          )}
          {perm === "granted" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const reg = await navigator.serviceWorker?.getRegistration();
                if (reg) await reg.showNotification("HealthOS test reminder", { body: "This is a test. Real reminders come from the server.", icon: "/icon.svg" });
                else new Notification("HealthOS test reminder", { body: "This is a test." });
              }}
            >
              Send a test
            </Button>
          )}
        </div>
        <Callout tone="warn" className="mt-4" title="Not a guaranteed alarm">
          Browsers, phone battery savers, permissions and connectivity can delay or block notifications. For important doses, also use another channel or an alarm you trust.
        </Callout>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold">How reminders are delivered</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-2">
          <li>• Each dose is generated from your confirmed schedule in your timezone ({s.timezone}).</li>
          <li>• A server job queues each reminder once, with retries, so the app doesn’t need to stay open.</li>
          <li>• Failed deliveries are kept and shown, never silently dropped.</li>
          <li>
            • Quiet hours: {s.quietHours ? `${s.quietHours.start}–${s.quietHours.end} (reminders are held, not discarded)` : "off"} · snooze {s.snoozeMinutes} min ·{" "}
            <Link href="/app/settings" className="text-pine underline">
              change
            </Link>
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Badge tone={s.channels.browser ? "ok" : "neutral"}>Browser {s.channels.browser ? "on" : "off"}</Badge>
          <Badge tone="neutral">Email: needs provider setup</Badge>
          <Badge tone="neutral">SMS: needs provider setup</Badge>
        </div>
        <p className="mt-4 text-xs text-muted">In demo mode no server is involved, so reminders aren’t actually sent. Live deployments run the reminder job described in the deployment guide.</p>
      </Card>
    </div>
  );
}
