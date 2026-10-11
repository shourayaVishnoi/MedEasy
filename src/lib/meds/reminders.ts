import type { Medicine } from "../types";
import { addDays, todayIn } from "../util";
import { occurrencesBetween } from "./schedule";

/**
 * Server-side reminder planning. Pure and deterministic so the cron route can
 * be retried safely: every notification has an idempotency key, and keys that
 * already exist are never re-queued.
 */

export type Channel = "browser" | "email" | "sms";
export type DeliveryStatus = "queued" | "sent" | "failed" | "held_quiet_hours";

export interface NotificationEvent {
  idempotencyKey: string;
  occurrenceKey: string;
  medicineId: string;
  profileId: string;
  channel: Channel;
  sendAt: string;
  status: DeliveryStatus;
  attempts: number;
  lastError?: string;
}

export interface ReminderPrefs {
  channels: Channel[];
  timezone: string;
  quietHours: { start: string; end: string } | null;
}

function minutesOfDay(d: Date, timezone: string): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(d)
    .split(":")
    .map(Number);
  return h * 60 + m;
}

export function inQuietHours(at: Date, prefs: ReminderPrefs): boolean {
  if (!prefs.quietHours) return false;
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const start = toMin(prefs.quietHours.start);
  const end = toMin(prefs.quietHours.end);
  const now = minutesOfDay(at, prefs.timezone);
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

/**
 * Plan reminders due within [now, now + lookaheadMinutes]. Existing keys are skipped,
 * so running the job twice never produces duplicates.
 */
export function planReminders(
  medicines: Medicine[],
  prefs: ReminderPrefs,
  existingKeys: Set<string>,
  now: Date,
  lookaheadMinutes = 15,
): NotificationEvent[] {
  const today = todayIn(prefs.timezone, now);
  const horizon = now.getTime() + lookaheadMinutes * 60000;
  const occ = occurrencesBetween(medicines, addDays(today, -1), addDays(today, 1)).filter(
    (o) => o.scheduledFor.getTime() >= now.getTime() - 5 * 60000 && o.scheduledFor.getTime() <= horizon,
  );
  const out: NotificationEvent[] = [];
  for (const o of occ) {
    for (const channel of prefs.channels) {
      const idempotencyKey = `${o.key}|${channel}`;
      if (existingKeys.has(idempotencyKey)) continue;
      existingKeys.add(idempotencyKey);
      out.push({
        idempotencyKey,
        occurrenceKey: o.key,
        medicineId: o.medicineId,
        profileId: o.profileId,
        channel,
        sendAt: o.scheduledFor.toISOString(),
        status: inQuietHours(o.scheduledFor, prefs) ? "held_quiet_hours" : "queued",
        attempts: 0,
      });
    }
  }
  return out;
}

export const MAX_ATTEMPTS = 3;

/** Record a delivery attempt. Failures are kept (never silently discarded). */
export function recordAttempt(e: NotificationEvent, ok: boolean, error?: string): NotificationEvent {
  const attempts = e.attempts + 1;
  if (ok) return { ...e, attempts, status: "sent", lastError: undefined };
  return { ...e, attempts, status: attempts >= MAX_ATTEMPTS ? "failed" : "queued", lastError: error ?? "Delivery failed" };
}
