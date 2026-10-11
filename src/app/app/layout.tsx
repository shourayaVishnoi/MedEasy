"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FlaskConical, FolderLock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Logo } from "@/components/Logo";
import { Button, Card, Field, Input, LoadingPage } from "@/components/ui";
import { useMounted, useWorkspace } from "@/lib/hooks";
import { getState, setCloudPersister, setCloudState, startBlankWorkspace, startDemo } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { cloudClient, hasUnsavedChanges, loadCloudWorkspace, persistCloud } from "@/lib/cloud/sync";

type Boot = "checking" | "ready" | { error: string };

/** Signed in → load the account from Supabase. Otherwise the browser-only demo workspace is used. */
function useCloudBoot(): [Boot, () => void] {
  const [boot, setBoot] = useState<Boot>(isSupabaseConfigured ? "checking" : "ready");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (getState()?.mode === "cloud") return setBoot("ready");
    let cancelled = false;
    (async () => {
      const { data } = (await cloudClient()?.auth.getSession()) ?? { data: { session: null } };
      if (!data.session) return !cancelled && setBoot("ready");
      try {
        setCloudPersister(persistCloud);
        const state = await loadCloudWorkspace();
        if (cancelled) return;
        setCloudState(state);
        setBoot("ready");
      } catch (e) {
        if (!cancelled) setBoot({ error: e instanceof Error ? e.message : "Couldn’t load your records." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (getState()?.mode === "cloud" && hasUnsavedChanges()) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return [boot, () => { setBoot("checking"); setAttempt((n) => n + 1); }];
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const [boot, retry] = useCloudBoot();
  const ws = useWorkspace();
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ws && !ws.state.settings.onboarded && path !== "/app/onboarding") router.replace("/app/onboarding");
  }, [ws, path, router]);

  if (typeof boot === "object") {
    return (
      <main id="main" className="mx-auto max-w-xl px-4 py-16 text-center">
        <Logo />
        <h1 className="mt-8 text-xl font-semibold">We couldn’t load your records</h1>
        <p className="mt-2 text-sm text-muted">{boot.error} Nothing has been changed. Check your connection and try again.</p>
        <Button className="mt-6" onClick={retry}>
          Try again
        </Button>
      </main>
    );
  }
  if (!mounted || boot === "checking") {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <LoadingPage />
      </div>
    );
  }
  if (!ws) return <NoWorkspace />;
  if (path === "/app/onboarding") return <>{children}</>;
  return <AppShell ws={ws}>{children}</AppShell>;
}

function NoWorkspace() {
  const [name, setName] = useState("");
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <Logo />
      <h1 className="mt-8 font-display text-4xl tracking-tight">Choose how to start</h1>
      <p className="mt-2 text-ink-2">
        Live accounts need the deployment’s authentication and database to be configured.{" "}
        <Link href="/auth/sign-in" className="font-medium text-accent underline underline-offset-2">
          Sign in
        </Link>{" "}
        if your deployment is set up. Until then, you can explore in this browser.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <FlaskConical className="h-6 w-6 text-accent" aria-hidden />
          <h2 className="mt-3 font-semibold">Explore with sample data</h2>
          <p className="mt-1 text-sm text-muted">Fictional people, reports and medicines, so you can see every feature without sharing anything real.</p>
          <Button className="mt-5 w-full" onClick={startDemo}>
            Open the sample workspace
          </Button>
        </Card>
        <Card className="p-5">
          <FolderLock className="h-6 w-6 text-accent" aria-hidden />
          <h2 className="mt-3 font-semibold">Start empty in this browser</h2>
          <p className="mt-1 text-sm text-muted">Try it with your own files. They stay only in this browser’s storage and are not backed up or synced.</p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              startBlankWorkspace(name.trim() || "Me");
            }}
          >
            <Field label="Your first name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />}</Field>
            <Button type="submit" variant="secondary" className="w-full">
              Start empty
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
