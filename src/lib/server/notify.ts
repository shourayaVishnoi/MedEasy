import "server-only";
import webpush from "web-push";
import type { Channel } from "@/lib/meds/reminders";

/**
 * Delivery adapters. Messages deliberately carry no medicine names or medical
 * details, because SMS and email are not private channels.
 */
export interface DeliveryResult {
  ok: boolean;
  error?: string;
  /** Push endpoints the browser vendor says are gone; the caller deletes them. */
  expiredEndpoints?: string[];
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const pushConfigured = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

async function sendPush(subs: PushTarget[]): Promise<DeliveryResult> {
  if (!pushConfigured()) return { ok: false, error: "Browser push not configured" };
  if (!subs.length) return { ok: false, error: "No device has notifications turned on" };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ?? "admin@example.com"}`, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const payload = JSON.stringify({ title: "MedEasy reminder", body: "You have a scheduled dose now. Open MedEasy to record it.", url: "/app/medicines" });
  let delivered = 0;
  const expiredEndpoints: string[] = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 30, urgency: "high" });
      delivered++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) expiredEndpoints.push(s.endpoint);
    }
  }
  return delivered ? { ok: true, expiredEndpoints } : { ok: false, error: "No device accepted the notification", expiredEndpoints };
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
const TEXT = `MedEasy reminder: you have a scheduled medicine dose now. Open ${APP_URL}/app/medicines to record it.`;

export async function deliver(channel: Channel, to: { email?: string | null; phone?: string | null; push?: PushTarget[] }): Promise<DeliveryResult> {
  try {
    if (channel === "email") {
      if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { ok: false, error: "Email provider not configured" };
      if (!to.email) return { ok: false, error: "No email address on file" };
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to.email], subject: "MedEasy reminder", text: TEXT }),
        signal: AbortSignal.timeout(10_000),
      });
      return r.ok ? { ok: true } : { ok: false, error: `Email provider returned ${r.status}` };
    }
    if (channel === "sms") {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_NUMBER;
      if (!sid || !token || !from) return { ok: false, error: "SMS provider not configured" };
      if (!to.phone) return { ok: false, error: "No phone number on file" };
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ From: from, To: to.phone, Body: TEXT }),
        signal: AbortSignal.timeout(10_000),
      });
      return r.ok ? { ok: true } : { ok: false, error: `SMS provider returned ${r.status}` };
    }
    return await sendPush(to.push ?? []);
  } catch {
    return { ok: false, error: "Network error contacting provider" };
  }
}
