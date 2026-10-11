"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Database, Eye, FlaskConical, KeyRound, Lock, MonitorSmartphone, Server, Trash2 } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { clearCloudState, resetWorkspace, update } from "@/lib/store";
import { cloudClient, flush, signOutCloud } from "@/lib/cloud/sync";
import { revokeShareLink } from "@/lib/actions";
import { shareLinkState } from "@/lib/share";
import { clearFiles } from "@/lib/fileStore";
import { buildExport } from "@/lib/exportData";
import { Badge, Button, Callout, Card, CardHeader, ConfirmDialog, LoadingPage, PageHeader, toast } from "@/components/ui";

const SERVICES = [
  { name: "Database & authentication (Supabase)", purpose: "Stores your account, records and extracted values; handles sign-in.", env: "Live deployments" },
  { name: "Private file storage (Supabase Storage)", purpose: "Keeps original documents in a private bucket with short-lived download links.", env: "Live deployments" },
  { name: "AI provider (Anthropic Claude)", purpose: "Optional explanations. Only the selected document’s text is sent, and only when you ask.", env: "Only if configured" },
  { name: "OCR provider", purpose: "Reads text from images and scanned PDFs.", env: "Only if configured" },
  { name: "SMS / email providers", purpose: "Sign-in codes and reminders you enable.", env: "Only if configured" },
];

export default function Privacy() {
  const ws = useWorkspace();
  const router = useRouter();
  const [confirm, setConfirm] = useState<"workspace" | "chat" | null>(null);
  if (!ws) return <LoadingPage />;
  const { state } = ws;
  const counts = {
    profiles: state.profiles.length,
    documents: state.documents.length,
    results: state.observations.length,
    medicines: state.medicines.length,
    doseLogs: state.doseLogs.length,
    appointments: state.appointments.length,
    healthEntries: state.healthEntries.length,
  };
  const activeLinks = state.shareLinks.filter((l) => shareLinkState(l) === "active");

  return (
    <div>
      <PageHeader title="Privacy & security" subtitle="See what’s stored, who can access it, and stay in control." />
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="What’s stored" icon={<Database className="h-5 w-5" />} subtitle="Across all profiles in this workspace" />
          <dl className="grid grid-cols-2 gap-3 p-5 text-sm sm:grid-cols-3">
            {Object.entries({ Profiles: counts.profiles, Documents: counts.documents, "Test results": counts.results, Medicines: counts.medicines, "Dose records": counts.doseLogs, Appointments: counts.appointments, "Health profile entries": counts.healthEntries }).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-sunken px-3 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="text-lg font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const all = state.profiles.map((p) => buildExport(state, p.id, { documentIds: state.documents.map((d) => d.id), includeMedications: true, includeAppointments: true }));
                const url = URL.createObjectURL(new Blob([JSON.stringify(all, null, 2)], { type: "application/json" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = "healthos-all-data.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                update((s) => s, { action: "export.full", detail: "Full data export downloaded" });
              }}
            >
              Export all my data
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Who can access what" icon={<Eye className="h-5 w-5" />} />
          <ul className="space-y-3 p-5 text-sm">
            {state.profiles.map((p) => {
              const g = state.grants.filter((x) => x.profileId === p.id && x.status !== "revoked");
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{p.displayName}</span>
                  <span className="text-muted">{g.length ? g.map((x) => `${x.granteeEmail} (${x.status === "pending" ? "pending" : x.role})`).join(", ") : "Only you"}</span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line p-5 text-sm">
            <p className="font-medium">Active share links: {activeLinks.length}</p>
            {activeLinks.map((l) => (
              <div key={l.id} className="mt-2 flex items-center justify-between gap-2">
                <span className="text-muted">
                  {l.label} · expires {new Date(l.expiresAt).toLocaleDateString()}
                </span>
                <Button size="sm" variant="ghost" onClick={() => { revokeShareLink(l.id); toast("Link revoked"); }}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Services that process data" icon={<Server className="h-5 w-5" />} subtitle={state.mode === "cloud" ? "Your account uses the services marked for live deployments." : "In demo mode, nothing leaves this browser."} />
          <ul className="divide-y divide-line px-5 pb-3 pt-2">
            {SERVICES.map((s) => (
              <li key={s.name} className="py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{s.name}</p>
                  <Badge tone="neutral" icon={false}>
                    {s.env}
                  </Badge>
                </div>
                <p className="text-muted">{s.purpose}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="AI features" icon={<KeyRound className="h-5 w-5" />} />
          <div className="space-y-3 p-5 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">Allow sending a document to the AI provider when I ask</span>
                <span className="text-muted">The built-in explainer always works locally without this.</span>
              </span>
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-pine)]" checked={state.settings.aiEnabled} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, aiEnabled: e.target.checked } }), { action: "settings.ai", detail: `AI provider use ${e.target.checked ? "enabled" : "disabled"}` })} />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-medium">Keep assistant question history</span>
              </span>
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-pine)]" checked={state.settings.keepAssistantHistory} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, keepAssistantHistory: e.target.checked } }))} />
            </label>
            <Button size="sm" variant="secondary" onClick={() => setConfirm("chat")}>
              Clear assistant history ({state.chat.length})
            </Button>
            <ul className="mt-2 space-y-1 text-muted">
              <li>• Your medical data is never used for advertising.</li>
              <li>• It is not used to train AI models.</li>
              <li>• Only the minimum needed for a request is sent to a provider.</li>
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="Sessions & sign-in" icon={<MonitorSmartphone className="h-5 w-5" />} />
          {state.mode === "cloud" ? (
            <div className="space-y-3 p-5 text-sm text-ink-2">
              <p>You’re signed in on this device. If you’ve used a shared or lost device, sign out everywhere.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={async () => { await signOutCloud(); clearCloudState(); router.push("/"); }}>
                  Sign out
                </Button>
                <Button size="sm" variant="secondary" onClick={async () => { await flush().catch(() => undefined); await cloudClient()?.auth.signOut({ scope: "global" }); clearCloudState(); router.push("/"); }}>
                  Sign out on all devices
                </Button>
              </div>
              <p className="text-xs text-muted">Change your password from the sign-in page (“Forgot password”).</p>
            </div>
          ) : (
            <div className="space-y-2 p-5 text-sm text-ink-2">
              <p>Demo mode has no account, so there are no sessions to manage.</p>
              <p>With a live account you can sign out of this or every device here.</p>
            </div>
          )}
        </Card>

        <Card id="demo">
          <CardHeader title="Delete data" icon={<Trash2 className="h-5 w-5" />} />
          <div className="space-y-3 p-5 text-sm text-ink-2">
            <p>Delete individual records from their page, or a person from Profiles & family.</p>
            <Button variant="danger" size="sm" onClick={() => setConfirm("workspace")}>
              {state.mode === "cloud" ? "Delete my account and all my records" : "Delete this whole workspace"}
            </Button>
            <p className="text-xs text-muted">
              {state.mode === "cloud"
                ? "Deletes every profile you own, their records and original files, and your sign-in. Profiles other people shared with you are theirs and stay. Database backups expire on your hosting provider’s retention schedule."
                : "Removes everything stored by this demo in this browser."}
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Activity log" subtitle="Sensitive actions are recorded without medical details." icon={<Lock className="h-5 w-5" />} />
        <ul className="max-h-80 divide-y divide-line overflow-auto px-5 pb-3 text-sm">
          {state.audit.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                <span className="font-mono text-xs text-muted">{a.action}</span> · {a.detail}
              </span>
              <time className="text-muted" dateTime={a.at}>
                {new Date(a.at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      </Card>

      {state.mode === "demo" && (
        <Callout tone="warn" className="mt-6" title={<span className="inline-flex items-center gap-1.5"><FlaskConical className="h-4 w-4" /> Demo workspace</span>}>
          This workspace lives only in this browser’s storage. It isn’t backed up, synced or protected by an account.
        </Callout>
      )}

      <ConfirmDialog
        open={confirm === "workspace"}
        onClose={() => setConfirm(null)}
        danger
        title={state.mode === "cloud" ? "Delete your account?" : "Delete the whole workspace?"}
        confirmLabel="Delete everything"
        onConfirm={async () => {
          if (state.mode === "cloud") {
            const res = await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
            const out = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) return toast(out.error ?? "Your account couldn’t be deleted. Nothing was removed.", "danger");
            await cloudClient()?.auth.signOut().catch(() => undefined);
            clearCloudState();
            router.push("/");
            return;
          }
          await clearFiles();
          resetWorkspace();
          router.push("/");
        }}
      >
        {state.mode === "cloud"
          ? "Every profile you own, with its records, original files, medicine schedules and history, will be permanently deleted, and you’ll be signed out. This can’t be undone. Export your data first if you want a copy."
          : "All profiles, records, original files, schedules and history in this browser will be permanently deleted."}
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "chat"} onClose={() => setConfirm(null)} title="Clear assistant history?" confirmLabel="Clear" onConfirm={() => { update((s) => ({ ...s, chat: [] }), { action: "assistant.cleared", detail: "Assistant history cleared" }); toast("Cleared"); }}>
        Your saved questions will be deleted. Your records are not affected.
      </ConfirmDialog>
    </div>
  );
}
