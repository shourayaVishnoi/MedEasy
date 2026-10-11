import type { DoseLog, ISODate, Medicine, MedicationSchedule } from "../types";
import { addDays, weekdayOf, zonedToUtc } from "../util";

export interface DoseOccurrence {
  key: string;
  medicineId: string;
  profileId: string;
  date: ISODate;
  time: string;
  scheduledFor: Date;
}

export type OccurrenceState = "upcoming" | "due" | "taken" | "skipped" | "unconfirmed" | "not_recorded";

export function occurrenceKey(medicineId: string, date: ISODate, time: string): string {
  return `${medicineId}|${date}|${time}`;
}

export function scheduleAppliesOn(s: MedicationSchedule, date: ISODate): boolean {
  if (date < s.startDate) return false;
  if (s.oneTime) return date === s.startDate;
  if (s.endDate && date > s.endDate) return false;
  if (s.weekdays.length > 0 && !s.weekdays.includes(weekdayOf(date))) return false;
  return true;
}

/** Occurrences for one local calendar date. Only active medicines generate doses. */
export function occurrencesOn(medicines: Medicine[], date: ISODate): DoseOccurrence[] {
  const out: DoseOccurrence[] = [];
  for (const m of medicines) {
    if (m.status !== "active" || !scheduleAppliesOn(m.schedule, date)) continue;
    for (const time of [...m.schedule.times].sort()) {
      out.push({
        key: occurrenceKey(m.id, date, time),
        medicineId: m.id,
        profileId: m.profileId,
        date,
        time,
        scheduledFor: zonedToUtc(date, time, m.schedule.timezone),
      });
    }
  }
  return out.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
}

export function occurrencesBetween(medicines: Medicine[], from: ISODate, to: ISODate): DoseOccurrence[] {
  const out: DoseOccurrence[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(...occurrencesOn(medicines, d));
  return out;
}

/**
 * State of a dose. An unrecorded past dose is "not_recorded": HealthOS never
 * assumes it was taken or missed.
 */
export function occurrenceState(occ: DoseOccurrence, log: DoseLog | undefined, now: Date, dueWindowMinutes = 60): OccurrenceState {
  if (log) return log.status;
  const diff = (now.getTime() - occ.scheduledFor.getTime()) / 60000;
  if (diff < 0) return "upcoming";
  if (diff <= dueWindowMinutes) return "due";
  return "not_recorded";
}

export const STATE_LABEL: Record<OccurrenceState, string> = {
  upcoming: "Upcoming",
  due: "Due now",
  taken: "Taken",
  skipped: "Skipped",
  unconfirmed: "Unconfirmed",
  not_recorded: "Not recorded",
};

export function validateSchedule(s: Partial<MedicationSchedule>): string[] {
  const errors: string[] = [];
  if (!s.times || s.times.length === 0) errors.push("Add at least one time. HealthOS does not pick dose times for you.");
  for (const t of s.times ?? []) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) errors.push(`"${t}" is not a valid time.`);
  if (s.times && new Set(s.times).size !== s.times.length) errors.push("The same time is listed twice.");
  if (!s.startDate) errors.push("Choose a start date.");
  if (s.startDate && s.endDate && s.endDate < s.startDate) errors.push("The end date is before the start date.");
  if (!s.timezone) errors.push("Choose a timezone.");
  return errors;
}
