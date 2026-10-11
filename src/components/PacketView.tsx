"use client";

import type { AppState } from "@/lib/types";
import { explainReport } from "@/lib/ai/explain";
import { CATEGORY_LABEL } from "@/lib/labels";
import { formatClock, formatDate } from "@/lib/util";

/** Read-only, print-friendly bundle of selected records. Used for PDF packets and shared links. */
export function PacketView({ state, profileId, documentIds, meds, appts, heading }: { state: AppState; profileId: string; documentIds: string[]; meds: boolean; appts: boolean; heading: string }) {
  const profile = state.profiles.find((p) => p.id === profileId);
  const docs = state.documents.filter((d) => d.profileId === profileId && documentIds.includes(d.id));
  const locale = state.settings.locale;
  return (
    <article className="mx-auto max-w-3xl space-y-8 print:max-w-none">
      <header className="border-b border-line pb-4">
        <p className="text-sm text-muted">{heading}</p>
        <h1 className="font-display text-3xl">{profile?.displayName}</h1>
        <p className="text-sm text-muted">
          {profile?.dateOfBirth ? `Date of birth ${formatDate(profile.dateOfBirth, locale)} · ` : ""}Prepared {new Date().toLocaleString(locale)}
        </p>
        {state.mode === "demo" && <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-sm font-medium text-warn">SAMPLE DATA – fictional records for demonstration only.</p>}
        <p className="mt-2 text-xs text-muted">Values are copied from the original documents. Unverified values are marked. Plain-language notes are informational and are not a clinical interpretation.</p>
      </header>

      {meds && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Medicines recorded as active</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1.5 pr-2">Medicine</th>
                <th className="py-1.5 pr-2">Dose</th>
                <th className="py-1.5 pr-2">Times</th>
                <th className="py-1.5">Prescriber</th>
              </tr>
            </thead>
            <tbody>
              {state.medicines.filter((m) => m.profileId === profileId && m.status === "active").map((m) => (
                <tr key={m.id} className="border-b border-line/60">
                  <td className="py-1.5 pr-2 font-medium">{m.name} {m.strength}</td>
                  <td className="py-1.5 pr-2">{m.dose}{m.frequencyText ? ` · ${m.frequencyText}` : ""}</td>
                  <td className="py-1.5 pr-2">{m.schedule.times.map((t) => formatClock(t, locale)).join(", ") || "As needed"}</td>
                  <td className="py-1.5">{m.prescriber ?? "—"}</td>
                </tr>
              ))}
              {!state.medicines.some((m) => m.profileId === profileId && m.status === "active") && (
                <tr>
                  <td colSpan={4} className="py-2 text-muted">No active medicines are recorded.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {docs.map((d) => {
        const obs = state.observations.filter((o) => o.documentId === d.id);
        const summary = d.category === "lab_report" && obs.length ? explainReport(d, obs, "summary") : null;
        return (
          <section key={d.id} className="break-inside-avoid">
            <h2 className="text-lg font-semibold">{d.title}</h2>
            <p className="text-sm text-muted">{CATEGORY_LABEL[d.category]} · {formatDate(d.documentDate, locale)}{d.provider ? ` · ${d.provider}` : ""}</p>
            {obs.length > 0 && (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="py-1.5 pr-2">Test</th>
                    <th className="py-1.5 pr-2">Result</th>
                    <th className="py-1.5 pr-2">Lab interval</th>
                    <th className="py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {obs.map((o) => (
                    <tr key={o.id} className="border-b border-line/60">
                      <td className="py-1.5 pr-2">{o.testName}</td>
                      <td className="py-1.5 pr-2 font-medium">{o.valueText} {o.unit ?? "(no unit)"}{o.flag ? ` ${o.flag}` : ""}</td>
                      <td className="py-1.5 pr-2">{o.refText ?? "Not printed"}</td>
                      <td className="py-1.5">{o.verification === "extracted" ? (o.reviewReasons.length ? "Unverified" : "Extracted") : o.verification === "corrected" ? "Corrected by patient" : "Confirmed by patient"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {summary && (
              <div className="mt-2 rounded-lg bg-sunken p-3 text-sm">
                <p className="font-medium">Plain-language summary</p>
                {summary.sections.flatMap((s) => s.items).map((i, k) => <p key={k} className="mt-1 text-ink-2">{i.text}</p>)}
              </div>
            )}
            {!obs.length && d.pages?.[0] && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-sunken p-3 font-mono text-xs">{d.pages.join("\n").slice(0, 3000)}</pre>}
          </section>
        );
      })}

      {appts && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Appointments</h2>
          <ul className="space-y-1 text-sm">
            {state.appointments.filter((a) => a.profileId === profileId).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).map((a) => (
              <li key={a.id}>{new Date(a.startsAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })} · {a.title}{a.provider ? ` · ${a.provider}` : ""} ({a.status})</li>
            ))}
            {!state.appointments.some((a) => a.profileId === profileId) && <li className="text-muted">No appointments are recorded.</li>}
          </ul>
        </section>
      )}
    </article>
  );
}
