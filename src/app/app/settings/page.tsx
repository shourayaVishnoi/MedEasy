"use client";

import { useWorkspace } from "@/lib/hooks";
import { update } from "@/lib/store";
import type { Settings } from "@/lib/types";
import { LANGUAGES } from "@/lib/i18n";
import { Card, CardHeader, Field, Input, LoadingPage, PageHeader, Select, toast } from "@/components/ui";
import { PushCard } from "@/components/PushCard";

export default function SettingsPage() {
  const ws = useWorkspace();
  if (!ws) return <LoadingPage />;
  const s = ws.state.settings;
  const set = (p: Partial<Settings>) => update((st) => ({ ...st, settings: { ...st.settings, ...p } }), { action: "settings.updated", detail: "Settings changed" });
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [s.timezone];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Card>
          <CardHeader title="You" />
          <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 p-5 sm:grid-cols-2">
            <Field label="Your name">{(id) => <Input id={id} defaultValue={s.name} onBlur={(e) => set({ name: e.target.value })} />}</Field>
            <Field label="Language" hint="More translations can be added without code changes.">
              {(id, h) => (
                <Select id={id} aria-describedby={h} value={s.language} onChange={(e) => set({ language: e.target.value })}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Date & number format">
              {(id) => (
                <Select id={id} value={s.locale} onChange={(e) => set({ locale: e.target.value })}>
                  {["en-GB", "en-US", "en-IN", "hi-IN", "ta-IN", "de-DE", "fr-FR", "es-ES", "ja-JP"].map((l) => (
                    <option key={l} value={l}>
                      {l} · {new Date().toLocaleDateString(l, { dateStyle: "medium" })}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Timezone" hint="Medicine times follow each schedule’s own timezone.">
              {(id, h) => (
                <Select id={id} aria-describedby={h} value={s.timezone} onChange={(e) => set({ timezone: e.target.value })}>
                  {zones.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Reminders" />
          <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 p-5 sm:grid-cols-2">
            <Field label="Snooze length">
              {(id) => (
                <Select id={id} value={s.snoozeMinutes} onChange={(e) => set({ snoozeMinutes: Number(e.target.value) })}>
                  {[5, 10, 15, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div />
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-pine)]" checked={!!s.quietHours} onChange={(e) => set({ quietHours: e.target.checked ? { start: "22:00", end: "07:00" } : null })} /> Quiet hours (reminders are held, not discarded)
            </label>
            {s.quietHours && (
              <>
                <Field label="Quiet from">{(id) => <Input id={id} type="time" value={s.quietHours!.start} onChange={(e) => set({ quietHours: { ...s.quietHours!, start: e.target.value } })} />}</Field>
                <Field label="Until">{(id) => <Input id={id} type="time" value={s.quietHours!.end} onChange={(e) => set({ quietHours: { ...s.quietHours!, end: e.target.value } })} />}</Field>
              </>
            )}
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">Channels</legend>
              <div className="mt-2 space-y-2 text-sm">
                {(["browser", "email", "sms"] as const).map((c) => (
                  <label key={c} className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--color-pine)]" checked={s.channels[c]} onChange={(e) => set({ channels: { ...s.channels, [c]: e.target.checked } })} />
                    {c === "browser" ? "Browser / app notifications" : c === "email" ? "Email (needs email provider)" : "SMS (needs SMS provider)"}
                  </label>
                ))}
              </div>
            </fieldset>
            {(s.channels.email || s.channels.sms) && (
              <>
                <Field label="Email for reminders" hint="Reminder messages never include medicine names or health details.">
                  {(id, h) => <Input id={id} aria-describedby={h} type="email" autoComplete="email" defaultValue={s.reminderEmail ?? ""} onBlur={(e) => set({ reminderEmail: e.target.value.trim() || undefined })} />}
                </Field>
                <Field label="Mobile number for SMS" hint="International format, e.g. +91 98765 43210.">
                  {(id, h) => (
                    <Input
                      id={id}
                      aria-describedby={h}
                      type="tel"
                      autoComplete="tel"
                      defaultValue={s.reminderPhone ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.replace(/[\s()-]/g, "");
                        if (v && !/^\+[1-9]\d{7,14}$/.test(v)) return toast("Enter the number with its country code, starting with +", "warn");
                        set({ reminderPhone: v || undefined });
                      }}
                    />
                  )}
                </Field>
              </>
            )}
          </div>
        </Card>
        <PushCard />
      </div>
    </div>
  );
}
