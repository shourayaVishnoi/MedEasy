"use client";

import { useState } from "react";
import { Copy, Download, FileJson, Link2, Printer, ShieldOff } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { createShareLink, revokeShareLink } from "@/lib/actions";
import { EXPIRY_OPTIONS, shareLinkState } from "@/lib/share";
import { CATEGORY_LABEL } from "@/lib/labels";
import { getFile } from "@/lib/fileStore";
import { update } from "@/lib/store";
import { buildExport } from "@/lib/exportData";
import { Badge, Button, Callout, Card, CardHeader, Field, Input, LoadingPage, PageHeader, Select, toast } from "@/components/ui";
import { formatDate } from "@/lib/util";

export default function SharePage() {
  const ws = useWorkspace();
  const [createdUrl, setCreatedUrl] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [meds, setMeds] = useState(true);
  const [appts, setAppts] = useState(true);
  const [label, setLabel] = useState("For my doctor");
  const [hours, setHours] = useState(24 * 7);
  if (!ws) return <LoadingPage />;
  const { state, profileId, profile } = ws;
  const docs = state.documents
    .filter((d) => d.profileId === profileId && (!from || (d.documentDate ?? "") >= from) && (!to || (d.documentDate ?? "") <= to))
    .sort((a, b) => (b.documentDate ?? "").localeCompare(a.documentDate ?? ""));
  const links = state.shareLinks.filter((l) => l.profileId === profileId);
  const chosen = selected.filter((id) => docs.some((d) => d.id === id));
  const audit = (detail: string) => update((s) => s, { action: "export.created", detail });

  function packet() {
    const params = new URLSearchParams({ docs: chosen.join(","), meds: meds ? "1" : "0", appts: appts ? "1" : "0" });
    audit(`PDF packet prepared (${chosen.length} documents)`);
    window.open(`/app/share/packet?${params}`, "_blank", "noopener");
  }
  function json() {
    const data = buildExport(state, profileId, { documentIds: chosen, includeMedications: meds, includeAppointments: appts });
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthos-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    audit("Structured data export downloaded");
  }
  async function originals() {
    let n = 0;
    for (const id of chosen) {
      const d = state.documents.find((x) => x.id === id);
      const blob = d?.fileKey ? await getFile(d.fileKey) : d?.pages ? new Blob([d.pages.join("\n")], { type: "text/plain" }) : undefined;
      if (!d || !blob) continue;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      n++;
    }
    audit(`${n} original files downloaded`);
    toast(`${n} file${n === 1 ? "" : "s"} downloaded`);
  }

  return (
    <div>
      <PageHeader title="Share & export" subtitle={`Choose exactly what to include from ${profile.displayName}’s records. Nothing is ever public by default.`} />
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="1. Choose records" subtitle={`${chosen.length} selected`} />
          <div className="grid grid-cols-1 [&>*]:min-w-0 gap-3 px-5 pt-4 sm:grid-cols-2">
            <Field label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
            <Field label="To">{(id) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
          </div>
          <div className="flex gap-3 px-5 pt-3 text-sm">
            <button className="font-medium text-pine underline" onClick={() => setSelected(docs.map((d) => d.id))}>
              Select all shown
            </button>
            <button className="font-medium text-muted underline" onClick={() => setSelected([])}>
              Clear
            </button>
          </div>
          <ul className="max-h-96 space-y-1 overflow-auto p-3">
            {docs.map((d) => (
              <li key={d.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-sunken">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-pine)]" checked={selected.includes(d.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, d.id] : selected.filter((x) => x !== d.id))} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{d.title}</span>
                    <span className="block text-xs text-muted">
                      {CATEGORY_LABEL[d.category]} · {formatDate(d.documentDate, state.settings.locale)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-line px-5 py-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-pine)]" checked={meds} onChange={(e) => setMeds(e.target.checked)} /> Include current medicine list
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-pine)]" checked={appts} onChange={(e) => setAppts(e.target.checked)} /> Include appointment history
            </label>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="2. Export" subtitle="Download to your device." icon={<Download className="h-5 w-5" />} />
            <div className="grid grid-cols-1 [&>*]:min-w-0 gap-2 p-5">
              <Button onClick={packet} disabled={!chosen.length && !meds && !appts}>
                <Printer className="h-4 w-4" aria-hidden /> PDF packet with summaries
              </Button>
              <Button variant="secondary" onClick={json}>
                <FileJson className="h-4 w-4" aria-hidden /> Structured data (JSON)
              </Button>
              <Button variant="secondary" onClick={originals} disabled={!chosen.length}>
                <Download className="h-4 w-4" aria-hidden /> Original files
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="3. Or create a private link" subtitle="For a doctor or caregiver. Expires automatically and can be revoked at once." icon={<Link2 className="h-5 w-5" />} />
            <div className="space-y-3 p-5">
              <Field label="Label (only you see this)">{(id) => <Input id={id} value={label} onChange={(e) => setLabel(e.target.value)} />}</Field>
              <Field label="Expires after">
                {(id) => (
                  <Select id={id} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    {EXPIRY_OPTIONS.map((o) => (
                      <option key={o.hours} value={o.hours}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button
                className="w-full"
                disabled={!chosen.length}
                onClick={() => {
                  const link = createShareLink({ profileId, label, documentIds: chosen, includeMedications: meds, includeAppointments: appts, expiresAt: new Date(Date.now() + hours * 3600000).toISOString() });
                  const url = `${location.origin}/shared#${link.token}`;
                  setCreatedUrl(url);
                  navigator.clipboard?.writeText(url).catch(() => {});
                  toast("Private link created and copied");
                }}
              >
                Create link for {chosen.length} record{chosen.length === 1 ? "" : "s"}
              </Button>
              {createdUrl && (
                <Field label="Your new link">{(id) => <Input id={id} readOnly value={createdUrl} onFocus={(e) => e.currentTarget.select()} />}</Field>
              )}
              <p className="text-xs text-muted">The link carries only a random token (kept after # so it isn’t sent to servers or logs). {ws.state.mode === "cloud" ? " Only a fingerprint of the token is stored, so copy the link now: it can’t be shown again later." : " In demo mode it opens only in this browser."}</p>
            </div>
          </Card>
        </div>
      </div>

      <h2 className="mb-3 mt-10 font-display text-2xl">Your share links</h2>
      {links.length === 0 ? (
        <p className="text-sm text-muted">No links created yet.</p>
      ) : (
        <ul className="space-y-2">
          {links.map((l) => {
            const st = shareLinkState(l);
            return (
              <li key={l.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{l.label}</p>
                    <p className="text-sm text-muted">
                      {l.documentIds.length} records{l.includeMedications ? " + medicines" : ""}
                      {l.includeAppointments ? " + appointments" : ""} · created {new Date(l.createdAt).toLocaleString()} · {st === "active" ? `expires ${new Date(l.expiresAt).toLocaleString()}` : st}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={st === "active" ? "ok" : "neutral"}>{st === "active" ? "Active" : st === "expired" ? "Expired" : "Revoked"}</Badge>
                    {st === "active" && (
                      <>
                        {l.token ? (
                          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/shared#${l.token}`); toast("Link copied"); }}>
                            <Copy className="h-4 w-4" aria-hidden /> Copy
                          </Button>
                        ) : (
                          <span className="text-xs text-muted" title="Only a fingerprint of the link is stored, so it can’t be shown again. Create a new link if you need it.">Link shown once</span>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => { revokeShareLink(l.id); toast("Link revoked"); }}>
                          <ShieldOff className="h-4 w-4" aria-hidden /> Revoke
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Callout tone="neutral" className="mt-6">
        Creating and revoking links is recorded in your activity log on the Privacy page.
      </Callout>
    </div>
  );
}
