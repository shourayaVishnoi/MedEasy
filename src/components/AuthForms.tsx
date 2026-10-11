"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import { Loader2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { countryOptions, toE164 } from "@/lib/auth/phone";
import { checkPassword } from "@/lib/auth/password";
import { Logo } from "./Logo";
import { Button, ButtonLink, Callout, Field, Input, Select } from "./ui";

const RESEND_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 5;

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
      <Link href="/">
        <Logo />
      </Link>
      <h1 className="mt-10 font-display text-3xl tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-ink-2">{subtitle}</p>}
      <div className="mt-8 space-y-5">
        {!isSupabaseConfigured && (
          <Callout tone="warn" title="Sign-in isn’t configured on this deployment">
            Accounts need Supabase Auth with an SMS provider and Google OAuth (see the setup guide). Nothing here is simulated, so these forms are disabled until then.{" "}
            <Link href="/demo" className="font-medium underline">
              Explore the demo instead
            </Link>
            .
          </Callout>
        )}
        {children}
      </div>
    </main>
  );
}

function PhoneInput({ country, setCountry, phone, setPhone, disabled }: { country: CountryCode; setCountry: (c: CountryCode) => void; phone: string; setPhone: (s: string) => void; disabled?: boolean }) {
  // Country names come from the runtime's ICU data, which differs between server and browser,
  // so the full list is built after hydration.
  const [options, setOptions] = useState<ReturnType<typeof countryOptions>>([]);
  useEffect(() => setOptions(countryOptions()), []);
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2">
      <Field label="Country">
        {(id) => (
          <Select id={id} value={country} onChange={(e) => setCountry(e.target.value as CountryCode)} disabled={disabled} autoComplete="country">
            {options.length === 0 && <option value={country}>{country}</option>}
            {options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name} ({o.dial})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Phone number">{(id) => <Input id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={disabled} />}</Field>
    </div>
  );
}

function useCooldown() {
  const [until, setUntil] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  return { left, start: () => setUntil(Date.now() + RESEND_SECONDS * 1000) };
}

function defaultCountry(): CountryCode {
  const region = typeof navigator !== "undefined" ? navigator.language.split("-")[1] : undefined;
  return (region?.toUpperCase() as CountryCode) || "IN";
}

export function GoogleButton({ next }: { next: string }) {
  return (
    <Button
      variant="secondary"
      className="w-full"
      disabled={!isSupabaseConfigured}
      onClick={() => supabaseBrowser()?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } })}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
      </svg>
      Continue with Google
    </Button>
  );
}

/** Phone OTP verification followed by creating a MedEasy password. */
export function SignUpFlow() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [country, setCountry] = useState<CountryCode>("IN");
  const [phone, setPhone] = useState("");
  const [e164, setE164] = useState("");
  const [code, setCode] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const cd = useCooldown();
  useEffect(() => setCountry(defaultCountry()), []);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("step") === "password") setStep("password");
  }, []);
  const strength = checkPassword(pw, [phone]);
  const sb = supabaseBrowser();

  async function sendCode() {
    setError(undefined);
    const n = toE164(phone, country);
    if (!n) return setError("That phone number doesn’t look valid for the selected country.");
    if (!sb) return;
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ phone: n, options: { shouldCreateUser: true, channel: "sms" } });
    setBusy(false);
    if (error) return setError(error.status === 429 ? "Too many codes requested. Please wait and try again." : "We couldn’t send a code. Check the number and try again.");
    setE164(n);
    setStep("code");
    cd.start();
  }
  async function verify() {
    if (!sb) return;
    if (attempts >= MAX_CODE_ATTEMPTS) return setError("Too many attempts. Request a new code.");
    setBusy(true);
    const { error } = await sb.auth.verifyOtp({ phone: e164, token: code.trim(), type: "sms" });
    setBusy(false);
    setAttempts((a) => a + 1);
    if (error) return setError("That code is incorrect or has expired.");
    setError(undefined);
    setStep("password");
  }
  async function savePassword() {
    if (!strength.ok) return setError(strength.problems[0]);
    if (pw !== pw2) return setError("The passwords don’t match.");
    if (!sb) return;
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError("We couldn’t save your password. Please try again.");
    router.replace("/app/onboarding");
  }

  return (
    <div className="space-y-4">
      {step === "phone" && (
        <>
          <PhoneInput country={country} setCountry={setCountry} phone={phone} setPhone={setPhone} disabled={!sb} />
          <Button className="w-full" onClick={sendCode} disabled={!sb || busy || !phone}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Send verification code
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <GoogleButton next="/auth/sign-up?step=password" />
          <p className="text-xs text-muted">With Google, MedEasy never sees your Google password. You’ll set a separate MedEasy password next.</p>
        </>
      )}
      {step === "code" && (
        <>
          <p className="text-sm text-ink-2">We sent a 6-digit code to {e164}. It expires shortly.</p>
          <Field label="Verification code" error={error}>
            {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />}
          </Field>
          <Button className="w-full" onClick={verify} disabled={busy || code.length < 6}>
            Verify
          </Button>
          <Button variant="ghost" className="w-full" onClick={sendCode} disabled={cd.left > 0 || busy}>
            {cd.left > 0 ? `Resend code in ${cd.left}s` : "Resend code"}
          </Button>
        </>
      )}
      {step === "password" && (
        <>
          <p className="text-sm text-ink-2">Create a MedEasy password so you can also sign in without a code.</p>
          <Field label="New password" hint={strength.problems[0] ?? "Strong password"}>{(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((k) => (
              <span key={k} className={`h-1.5 flex-1 rounded-full ${k < strength.score ? (strength.score >= 3 ? "bg-ok" : "bg-warn") : "bg-line"}`} />
            ))}
          </div>
          <Field label="Confirm password">{(id) => <Input id={id} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />}</Field>
          <Button className="w-full" onClick={savePassword} disabled={busy}>
            Save password and continue
          </Button>
        </>
      )}
      {error && step !== "code" && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SignInFlow() {
  const router = useRouter();
  const [country, setCountry] = useState<CountryCode>("IN");
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  useEffect(() => setCountry(defaultCountry()), []);
  const sb = supabaseBrowser();
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const n = toE164(phone, country);
    if (!n) return setError("That phone number doesn’t look valid.");
    if (!sb) return;
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ phone: n, password: pw });
    setBusy(false);
    // Same message for wrong number or password, so accounts can't be enumerated.
    if (error) return setError(error.status === 429 ? "Too many attempts. Please wait a few minutes." : "Phone number or password is incorrect.");
    router.replace("/app");
  }
  return (
    <form onSubmit={signIn} className="space-y-4">
      <PhoneInput country={country} setCountry={setCountry} phone={phone} setPhone={setPhone} disabled={!sb} />
      <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} disabled={!sb} />}</Field>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={!sb || busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Sign in
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/auth/reset" className="font-medium text-accent underline underline-offset-2">
          Forgot password?
        </Link>
        <Link href="/auth/sign-up" className="font-medium text-accent underline underline-offset-2">
          Create an account
        </Link>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton next="/app" />
      <ButtonLink href="/demo" variant="ghost" className="w-full">
        Explore the demo without an account
      </ButtonLink>
    </form>
  );
}

/** Password reset through the verified phone number (OTP), then a new password. */
export function ResetFlow() {
  const router = useRouter();
  const [country, setCountry] = useState<CountryCode>("IN");
  const [phone, setPhone] = useState("");
  const [e164, setE164] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [error, setError] = useState<string>();
  const cd = useCooldown();
  useEffect(() => setCountry(defaultCountry()), []);
  const sb = supabaseBrowser();
  const strength = checkPassword(pw, [phone]);
  return (
    <div className="space-y-4">
      {step === "phone" && (
        <>
          <PhoneInput country={country} setCountry={setCountry} phone={phone} setPhone={setPhone} disabled={!sb} />
          <Button
            className="w-full"
            disabled={!sb || !phone || cd.left > 0}
            onClick={async () => {
              const n = toE164(phone, country);
              if (!n || !sb) return setError("That phone number doesn’t look valid.");
              // Only existing, verified accounts receive a code; the response is the same either way.
              await sb.auth.signInWithOtp({ phone: n, options: { shouldCreateUser: false } });
              setE164(n);
              setStep("code");
              cd.start();
            }}
          >
            Send reset code
          </Button>
        </>
      )}
      {step === "code" && (
        <>
          <p className="text-sm text-ink-2">If an account uses {e164}, we sent it a code.</p>
          <Field label="Code">{(id) => <Input id={id} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />}</Field>
          <Button
            className="w-full"
            onClick={async () => {
              const { error } = (await sb?.auth.verifyOtp({ phone: e164, token: code, type: "sms" })) ?? {};
              if (error) return setError("That code is incorrect or has expired.");
              setError(undefined);
              setStep("password");
            }}
          >
            Verify
          </Button>
        </>
      )}
      {step === "password" && (
        <>
          <Field label="New password" hint={strength.problems[0]}>{(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}</Field>
          <Button
            className="w-full"
            onClick={async () => {
              if (!strength.ok) return setError(strength.problems[0]);
              const { error } = (await sb?.auth.updateUser({ password: pw })) ?? {};
              if (error) return setError("Couldn’t update the password. Try again.");
              await sb?.auth.signOut({ scope: "others" });
              router.replace("/app");
            }}
          >
            Save new password
          </Button>
          <p className="text-xs text-muted">Other devices will be signed out.</p>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
