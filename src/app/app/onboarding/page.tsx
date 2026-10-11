"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BellRing, FileUp, HeartPulse, Lock, Pill, Sparkles } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { update } from "@/lib/store";
import { saveProfile } from "@/lib/actions";
import { uid } from "@/lib/util";
import { LANGUAGES } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { Button, Field, Input, LoadingPage, Select } from "@/components/ui";

const STEPS = ["Welcome", "About you", "Reminders", "Health profile", "Privacy", "First record", "Explanations", "Medicines"];

export default function Onboarding() {
  const ws = useWorkspace();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [name, setName] = useState(ws?.state.settings.name ?? "");
  const [lang, setLang] = useState(ws?.state.settings.language ?? "en");
  const [tz, setTz] = useState(ws?.state.settings.timezone ?? "UTC");
  const [browser, setBrowser] = useState(true);
  const [dob, setDob] = useState("");
  const [allergy, setAllergy] = useState("");
  if (!ws) return <LoadingPage />;
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [tz];

  function finish(to = "/app") {
    update((s) => ({ ...s, settings: { ...s.settings, name: name || s.settings.name, language: lang, timezone: tz, channels: { ...s.settings.channels, browser }, onboarded: true, onboardedAt: new Date().toISOString() } }), { action: "onboarding.completed", detail: "Onboarding completed" });
    const p = ws!.profile;
    saveProfile({ ...p, displayName: name || p.displayName, dateOfBirth: dob || p.dateOfBirth });
    if (allergy.trim()) update((s) => ({ ...s, healthEntries: [...s.healthEntries, { id: uid("h"), profileId: p.id, kind: "allergy", text: allergy.trim(), source: "user", recordedAt: new Date().toISOString() }] }));
    router.replace(to);
  }

  const panels = [
    <Panel key="w" icon={<HeartPulse />} title="Welcome to HealthOS" body="A calm place for your medical records, medicines and appointments, with plain-language explanations of your reports. It takes about a minute to set up, and you can skip anything." />,
    <Panel key="n" icon={<Sparkles />} title="What should we call you?">
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 sm:grid-cols-2">
        <Field label="First name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />}</Field>
        <Field label="Preferred language">
          {(id) => (
            <Select id={id} value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Panel>,
    <Panel key="r" icon={<BellRing />} title="Your timezone and reminders" body="Medicine times follow your timezone, including daylight-saving changes.">
      <div className="space-y-3">
        <Field label="Timezone">
          {(id) => (
            <Select id={id} value={tz} onChange={(e) => setTz(e.target.value)}>
              {zones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </Select>
          )}
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-pine)]" checked={browser} onChange={(e) => setBrowser(e.target.checked)} /> Use browser notifications for reminders (you can change this anytime)
        </label>
      </div>
    </Panel>,
    <Panel key="h" icon={<HeartPulse />} title="Start a health profile (optional)" body="Only add what’s useful to you. You can always use HealthOS without sharing this.">
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 sm:grid-cols-2">
        <Field label="Date of birth">{(id) => <Input id={id} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />}</Field>
        <Field label="Any allergy to note?">{(id) => <Input id={id} value={allergy} onChange={(e) => setAllergy(e.target.value)} placeholder="Optional" />}</Field>
      </div>
    </Panel>,
    <Panel key="p" icon={<Lock />} title="Your information stays yours" body={`Records are private by default. Only people you invite can see a profile, and you can revoke access at any time. Your medical data is never used for advertising or to train AI models. ${ws.state.mode === "cloud" ? "Your records are stored in your private account and protected by per-profile access rules." : "In this demo, everything stays in this browser."}`} />,
    <Panel key="f" icon={<FileUp />} title="Add your first record" body="Upload a lab report or prescription. The original is stored unchanged, and anything HealthOS isn’t sure about is flagged for you to check.">
      <Button variant="secondary" onClick={() => finish("/app/documents/upload")}>
        Upload now
      </Button>
    </Panel>,
    <Panel key="e" icon={<Sparkles />} title="Understanding your reports" body="Each explanation shows what your report says (with the exact line it came from), general background, and what the report alone can’t tell you, plus questions you could ask your doctor. It never diagnoses." />,
    <Panel key="m" icon={<Pill />} title="How medicine schedules work" body="After you check a prescription against the original, you choose the times you take each medicine. HealthOS then reminds you and keeps a history of taken, skipped and unconfirmed doses. It never changes a dose or guesses missing instructions." />,
  ];

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-8">
      <div className="flex items-center justify-between">
        <Logo />
        <button className="text-sm font-medium text-muted underline" onClick={() => finish()}>
          Skip setup
        </button>
      </div>
      <div className="mt-8 flex gap-1.5" aria-hidden>
        {STEPS.map((s, k) => (
          <span key={s} className={`h-1.5 flex-1 rounded-full ${k <= i ? "bg-pine" : "bg-line"}`} />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        Step {i + 1} of {STEPS.length} · {STEPS[i]}
      </p>
      <div className="mt-6 flex-1 animate-rise" key={i}>
        {panels[i]}
      </div>
      <div className="mt-8 flex justify-between gap-2">
        <Button variant="ghost" onClick={() => setI((x) => x - 1)} disabled={i === 0}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        {i < STEPS.length - 1 ? (
          <Button onClick={() => setI((x) => x + 1)}>
            {i === 3 && !dob && !allergy ? "Skip for now" : "Continue"} <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button onClick={() => finish()}>Go to my dashboard</Button>
        )}
      </div>
    </main>
  );
}

function Panel({ icon, title, body, children }: { icon: React.ReactNode; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <section>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pine-soft text-pine [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      <h1 className="mt-5 font-display text-3xl tracking-tight">{title}</h1>
      {body && <p className="mt-3 text-[1.02rem] leading-relaxed text-ink-2">{body}</p>}
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}
