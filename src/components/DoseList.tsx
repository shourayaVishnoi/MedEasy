"use client";

import { useState } from "react";
import { BellRing, Check, Clock3, HelpCircle, MoreHorizontal, SkipForward, Undo2 } from "lucide-react";
import type { AppState, DoseLog, Medicine } from "@/lib/types";
import { occurrenceState, STATE_LABEL, type DoseOccurrence, type OccurrenceState } from "@/lib/meds/schedule";
import { logDose, undoDose } from "@/lib/actions";
import { Badge, Button, Callout, Field, Input, Modal, Textarea, toast, type Tone } from "./ui";
import { cx, formatClock } from "@/lib/util";

const STATE_TONE: Record<OccurrenceState, Tone> = {
  upcoming: "neutral",
  due: "pine",
  taken: "ok",
  skipped: "info",
  unconfirmed: "warn",
  not_recorded: "warn",
};

export function DoseList({ state, occurrences, now, compact }: { state: AppState; occurrences: DoseOccurrence[]; now: Date; compact?: boolean }) {
  const [active, setActive] = useState<DoseOccurrence | null>(null);
  const logs = new Map(state.doseLogs.map((l) => [l.occurrenceKey, l]));
  const meds = new Map(state.medicines.map((m) => [m.id, m]));
  const snoozed = useSnoozes();

  return (
    <>
      <ol className="space-y-2.5">
        {occurrences.map((o) => {
          const med = meds.get(o.medicineId);
          if (!med) return null;
          const log = logs.get(o.key);
          const st = occurrenceState(o, log, now);
          const snoozeUntil = snoozed.get(o.key);
          return (
            <li key={o.key} className={cx("flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition", st === "due" ? "border-pine/40 bg-pine-soft/40" : "border-line bg-surface")}>
              <span className="w-11 shrink-0 sm:w-14 text-sm font-semibold tabular-nums text-ink-2">{formatClock(o.time, state.settings.locale)}</span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium leading-snug sm:truncate">
                  {med.name}
                  {med.strength && <span className="font-normal text-muted"> {med.strength}</span>}
                </p>
                <p className="truncate text-sm text-muted">
                  {med.dose}
                  {med.instructions && !compact ? ` · ${med.instructions}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Badge>
                  {log?.takenAt && <Badge tone="neutral" icon={<Clock3 className="h-3 w-3" />}>at {new Date(log.takenAt).toLocaleTimeString(state.settings.locale, { hour: "numeric", minute: "2-digit" })}</Badge>}
                  {snoozeUntil && !log && <Badge tone="info" icon={<BellRing className="h-3 w-3" />}>Snoozed until {snoozeUntil.toLocaleTimeString(state.settings.locale, { hour: "numeric", minute: "2-digit" })}</Badge>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!log && (st === "due" || st === "not_recorded" || st === "upcoming") && (
                  <Button size="sm" variant={st === "upcoming" ? "secondary" : "primary"} onClick={() => { logDose(o, "taken"); toast(`${med.name} recorded as taken`); }} aria-label={`Mark ${med.name} at ${o.time} as taken`}>
                    <Check className="h-4 w-4" aria-hidden />
                    <span className="hidden sm:inline">Taken</span>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setActive(o)} aria-label={`More options for ${med.name} at ${o.time}`}>
                  <MoreHorizontal className="h-5 w-5" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      {active && <DoseModal occ={active} med={meds.get(active.medicineId)!} log={logs.get(active.key)} onClose={() => setActive(null)} state={state} />}
    </>
  );
}

const snoozeStore = new Map<string, Date>();
function useSnoozes() {
  return snoozeStore;
}

function DoseModal({ occ, med, log, onClose, state }: { occ: DoseOccurrence; med: Medicine; log?: DoseLog; onClose: () => void; state: AppState }) {
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [takenAt, setTakenAt] = useState(local);
  const [note, setNote] = useState(log?.note ?? "");
  const rx = med.prescriptionId ? state.prescriptions.find((p) => p.id === med.prescriptionId) : undefined;
  const done = (msg: string) => {
    toast(msg);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`${med.name} · ${formatClock(occ.time, state.settings.locale)}`}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-sunken px-4 py-3 text-sm">
          <p className="font-medium">Instructions on record</p>
          <p className="mt-1 text-ink-2">
            {med.dose}
            {med.strength ? ` of ${med.strength}` : ""} · {med.frequencyText ?? "Frequency as entered"}
            {med.route ? ` · ${med.route}` : ""}
          </p>
          {med.instructions && <p className="mt-1 text-ink-2">{med.instructions}</p>}
          {rx && <p className="mt-1 text-xs text-muted">From a prescription by {rx.prescriber ?? "an unknown prescriber"}{rx.prescribedOn ? ` on ${rx.prescribedOn}` : ""}.</p>}
        </div>

        <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 sm:grid-cols-2">
          <Field label="Time taken">{(id) => <Input id={id} type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />}</Field>
          <Field label="Note (optional)">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-11" rows={1} />}</Field>
        </div>

        <div className="grid grid-cols-1 [&>*]:min-w-0 gap-2 sm:grid-cols-2">
          <Button onClick={() => { logDose(occ, "taken", { takenAt: new Date(takenAt).toISOString(), note: note || undefined }); done("Recorded as taken"); }}>
            <Check className="h-4 w-4" aria-hidden /> Taken at this time
          </Button>
          <Button variant="secondary" onClick={() => { logDose(occ, "skipped", { note: note || undefined }); done("Recorded as skipped"); }}>
            <SkipForward className="h-4 w-4" aria-hidden /> Skipped
          </Button>
          <Button variant="secondary" onClick={() => { logDose(occ, "unconfirmed", { note: note || undefined }); done("Recorded as unconfirmed"); }}>
            <HelpCircle className="h-4 w-4" aria-hidden /> Not sure (unconfirmed)
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              snoozeStore.set(occ.key, new Date(Date.now() + state.settings.snoozeMinutes * 60000));
              done(`Snoozed for ${state.settings.snoozeMinutes} minutes`);
            }}
          >
            <BellRing className="h-4 w-4" aria-hidden /> Snooze {state.settings.snoozeMinutes} min
          </Button>
          {log && (
            <Button variant="ghost" onClick={() => { undoDose(occ.key); done("Record cleared"); }} className="sm:col-span-2">
              <Undo2 className="h-4 w-4" aria-hidden /> Clear this record
            </Button>
          )}
        </div>

        <Callout tone="info" title="If you missed a dose">
          HealthOS doesn’t calculate replacement doses and won’t suggest doubling the next one. Follow your medicine’s instructions or ask your pharmacist or prescriber.
        </Callout>
      </div>
    </Modal>
  );
}
