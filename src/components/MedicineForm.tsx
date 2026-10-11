"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Medicine, MedicationSchedule } from "@/lib/types";
import { validateSchedule } from "@/lib/meds/schedule";
import { Button, Callout, Field, Input, Select, Textarea } from "./ui";
import { addDays, cx, todayIn } from "@/lib/util";

export type MedicineDraft = Omit<Medicine, "id" | "createdAt" | "profileId" | "status">;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function emptyDraft(timezone: string): MedicineDraft {
  return { name: "", strength: "", dose: "", route: "", frequencyText: "", instructions: "", prescriber: "", schedule: { times: [], weekdays: [], startDate: todayIn(timezone), timezone } };
}

/**
 * Medicine + schedule form. Times are always chosen by the user: MedEasy
 * never fills in dose times from a frequency on its own.
 */
export function MedicineForm({ initial, onSubmit, submitLabel, asNeeded, durationHint, lockIdentity }: { initial: MedicineDraft; onSubmit: (d: MedicineDraft) => void; submitLabel: string; asNeeded?: boolean; durationHint?: string; lockIdentity?: boolean }) {
  const [d, setD] = useState<MedicineDraft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [noSchedule, setNoSchedule] = useState(!!asNeeded);
  const s = d.schedule;
  const setS = (p: Partial<MedicationSchedule>) => setD({ ...d, schedule: { ...s, ...p } });
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [s.timezone];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (!d.name.trim()) errs.push("Enter the medicine name.");
    if (!d.dose.trim()) errs.push("Enter the dose exactly as prescribed.");
    if (!noSchedule) errs.push(...validateSchedule(s));
    setErrors(errs);
    if (!errs.length) onSubmit(noSchedule ? { ...d, schedule: { ...s, times: [] } } : d);
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Medicine name" required>{(id) => <Input id={id} value={d.name} readOnly={lockIdentity} onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
        <Field label="Strength">{(id) => <Input id={id} value={d.strength ?? ""} onChange={(e) => setD({ ...d, strength: e.target.value })} placeholder="e.g. 500 mg" />}</Field>
        <Field label="Dose as prescribed" required hint="Exactly as written, e.g. “1 tablet”.">{(id, h) => <Input id={id} aria-describedby={h} value={d.dose} onChange={(e) => setD({ ...d, dose: e.target.value })} />}</Field>
        <Field label="Route">{(id) => <Input id={id} value={d.route ?? ""} onChange={(e) => setD({ ...d, route: e.target.value })} placeholder="e.g. Oral" />}</Field>
        <Field label="Frequency as written">{(id) => <Input id={id} value={d.frequencyText ?? ""} onChange={(e) => setD({ ...d, frequencyText: e.target.value })} placeholder="e.g. Twice daily" />}</Field>
        <Field label="Prescriber">{(id) => <Input id={id} value={d.prescriber ?? ""} onChange={(e) => setD({ ...d, prescriber: e.target.value })} />}</Field>
        <div className="sm:col-span-2">
          <Field label="Instructions">{(id) => <Textarea id={id} rows={2} value={d.instructions ?? ""} onChange={(e) => setD({ ...d, instructions: e.target.value })} placeholder="e.g. After food (only if written on the prescription)" />}</Field>
        </div>
      </div>

      <fieldset className="rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Schedule</legend>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={noSchedule} onChange={(e) => setNoSchedule(e.target.checked)} className="h-4 w-4 accent-[var(--color-pine)]" />
          As needed – keep in my list without scheduled reminders
        </label>
        {!noSchedule && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">Dose times</p>
              <p className="text-xs text-muted">Add each time you take this medicine. MedEasy doesn’t choose times for you.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {s.times.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface pl-2">
                    <Input type="time" aria-label={`Dose time ${i + 1}`} value={t} onChange={(e) => setS({ times: s.times.map((x, j) => (j === i ? e.target.value : x)) })} className="h-9 w-32 border-0 px-1" />
                    <button type="button" onClick={() => setS({ times: s.times.filter((_, j) => j !== i) })} className="grid h-9 w-9 place-items-center text-muted hover:text-danger" aria-label={`Remove time ${t}`}>
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ))}
                <Button size="sm" variant="quiet" onClick={() => setS({ times: [...s.times, "08:00"] })}>
                  <Plus className="h-4 w-4" aria-hidden /> Add time
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Days</p>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
                <button type="button" aria-pressed={s.weekdays.length === 0} onClick={() => setS({ weekdays: [] })} className={cx("rounded-full border px-3 py-1.5 text-sm", s.weekdays.length === 0 ? "border-pine bg-pine-soft text-accent" : "border-line")}>
                  Every day
                </button>
                {DAYS.map((label, i) => {
                  const on = s.weekdays.includes(i);
                  return (
                    <button key={label} type="button" aria-pressed={on} onClick={() => setS({ weekdays: on ? s.weekdays.filter((x) => x !== i) : [...s.weekdays, i].sort() })} className={cx("rounded-full border px-3 py-1.5 text-sm", on ? "border-pine bg-pine-soft text-accent" : "border-line")}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 sm:grid-cols-3">
              <Field label="Start date">{(id) => <Input id={id} type="date" value={s.startDate} onChange={(e) => setS({ startDate: e.target.value })} />}</Field>
              <Field label="End date" hint={durationHint ? `Prescription says: ${durationHint}` : "Optional"}>
                {(id, h) => (
                  <div className="flex gap-2">
                    <Input id={id} aria-describedby={h} type="date" value={s.endDate ?? ""} onChange={(e) => setS({ endDate: e.target.value || undefined })} />
                  </div>
                )}
              </Field>
              <Field label="Timezone">
                {(id) => (
                  <Select id={id} value={s.timezone} onChange={(e) => setS({ timezone: e.target.value })}>
                    {zones.map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!s.oneTime} onChange={(e) => setS({ oneTime: e.target.checked })} className="h-4 w-4 accent-[var(--color-pine)]" />
              One-time reminder (only on the start date)
            </label>
            {durationHint && s.startDate && !s.endDate && /^(\d+) days?$/.test(durationHint) && (
              <button type="button" className="text-sm font-medium text-accent underline underline-offset-2" onClick={() => setS({ endDate: addDays(s.startDate, Number(durationHint.split(" ")[0]) - 1) })}>
                Use end date from “{durationHint}” starting {s.startDate}
              </button>
            )}
          </div>
        )}
      </fieldset>

      {errors.length > 0 && (
        <Callout tone="danger" title="Please fix the following">
          <ul className="list-disc pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Callout>
      )}
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
