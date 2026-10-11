import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { inQuietHours, planReminders, recordAttempt, type Channel, type NotificationEvent } from "@/lib/meds/reminders";
import { deliver } from "@/lib/server/notify";
import type { Medicine } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Reminder job, triggered by Vercel Cron. Safe to run repeatedly: events are
 * keyed by idempotency key (unique in the database), so retries never send
 * duplicates, and failed deliveries are recorded rather than dropped.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = supabaseService();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const now = new Date();
  let planned = 0;

  // 1. Plan upcoming reminders from verified, active schedules.
  const { data: meds, error } = await db
    .from("medicines")
    .select("id, profile_id, name, dose, status, medication_schedules(times, weekdays, start_date, end_date, timezone, one_time), health_profiles(owner_id)")
    .eq("status", "active")
    .limit(5000);
  if (error) return NextResponse.json({ error: "Query failed" }, { status: 500 });

  const byOwner = new Map<string, Medicine[]>();
  for (const m of meds ?? []) {
    const s = Array.isArray(m.medication_schedules) ? m.medication_schedules[0] : m.medication_schedules;
    const owner = (Array.isArray(m.health_profiles) ? m.health_profiles[0] : m.health_profiles)?.owner_id as string | undefined;
    if (!s || !owner || !s.times?.length) continue;
    const med: Medicine = {
      id: m.id, profileId: m.profile_id, name: m.name, dose: m.dose, status: "active", createdAt: "",
      schedule: { times: s.times, weekdays: s.weekdays ?? [], startDate: s.start_date, endDate: s.end_date ?? undefined, timezone: s.timezone, oneTime: s.one_time },
    };
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), med]);
  }

  for (const [owner, list] of byOwner) {
    const { data: prefs } = await db.from("notification_preferences").select("*").eq("user_id", owner).maybeSingle();
    const channels = ((prefs?.channels as Channel[] | undefined) ?? ["browser"]).filter((c) => ["browser", "email", "sms"].includes(c));
    const events = planReminders(
      list,
      { channels, timezone: prefs?.timezone ?? "UTC", quietHours: prefs?.quiet_start && prefs?.quiet_end ? { start: String(prefs.quiet_start).slice(0, 5), end: String(prefs.quiet_end).slice(0, 5) } : null },
      new Set(),
      now,
    );
    if (!events.length) continue;
    const rows = events.map((e) => ({ idempotency_key: e.idempotencyKey, occurrence_key: e.occurrenceKey, profile_id: e.profileId, medicine_id: e.medicineId, user_id: owner, channel: e.channel, send_at: e.sendAt, status: e.status, attempts: 0 }));
    const { count } = await db.from("notification_events").upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true, count: "exact" });
    planned += count ?? 0;
  }

  // 2. Deliver due events. Events held for quiet hours are delivered once quiet hours end.
  const { data: due } = await db.from("notification_events").select("*").in("status", ["queued", "held_quiet_hours"]).lte("send_at", now.toISOString()).limit(200);
  let sent = 0;
  let failed = 0;
  for (const row of due ?? []) {
    // Skip if the dose was already recorded – no reminder needed.
    const { data: logged } = await db.from("dose_logs").select("id").eq("occurrence_key", row.occurrence_key).maybeSingle();
    if (logged) {
      await db.from("notification_events").update({ status: "sent", last_error: "Skipped: dose already recorded" }).eq("id", row.id);
      continue;
    }
    const { data: prefs } = await db.from("notification_preferences").select("email, phone_e164, timezone, quiet_start, quiet_end").eq("user_id", row.user_id).maybeSingle();
    if (row.status === "held_quiet_hours" && prefs?.quiet_start && prefs?.quiet_end && inQuietHours(now, { channels: [], timezone: prefs.timezone ?? "UTC", quietHours: { start: String(prefs.quiet_start).slice(0, 5), end: String(prefs.quiet_end).slice(0, 5) } })) continue;
    const push = row.channel === "browser" ? ((await db.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", row.user_id)).data ?? []) : [];
    const result = await deliver(row.channel, { email: prefs?.email, phone: prefs?.phone_e164, push });
    if (result.expiredEndpoints?.length) await db.from("push_subscriptions").delete().in("endpoint", result.expiredEndpoints);
    const ev: NotificationEvent = { idempotencyKey: row.idempotency_key, occurrenceKey: row.occurrence_key, medicineId: row.medicine_id, profileId: row.profile_id, channel: row.channel, sendAt: row.send_at, status: row.status, attempts: row.attempts };
    const next = recordAttempt(ev, result.ok, result.error);
    // Optimistic concurrency: only update if no other run touched this event.
    await db.from("notification_events").update({ status: next.status, attempts: next.attempts, last_error: next.lastError ?? null, sent_at: result.ok ? now.toISOString() : null }).eq("id", row.id).eq("attempts", row.attempts);
    if (result.ok) sent++;
    else failed++;
  }

  // 3. Housekeeping: delete share links that expired more than 30 days ago.
  await db.from("share_links").delete().lt("expires_at", new Date(now.getTime() - 30 * 86400000).toISOString());

  return NextResponse.json({ planned, sent, failed, at: now.toISOString() });
}
