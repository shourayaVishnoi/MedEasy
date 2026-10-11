"use client";

import Link from "next/link";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChart as LineIcon, Unlink } from "lucide-react";
import { useWorkspace } from "@/lib/hooks";
import { buildComparisons, describeChange, type ComparableSeries } from "@/lib/reports/compare";
import { Badge, ButtonLink, Callout, Card, EmptyState, LoadingPage, PageHeader, Select } from "@/components/ui";
import { formatDate } from "@/lib/util";

const unverifiedCount = (s: ComparableSeries) => s.points.filter((p) => p.verification === "extracted" && p.reviewReasons.length > 0).length;

export default function Compare() {
  const ws = useWorkspace();
  const [selected, setSelected] = useState<string>("");
  if (!ws) return <LoadingPage />;
  const obs = ws.state.observations.filter((o) => o.profileId === ws.profileId);
  const { series, incomparable } = buildComparisons(obs);
  const multi = series.filter((s) => s.points.length > 1);
  const byPoints = [...multi].sort((a, b) => b.points.length - a.points.length || unverifiedCount(a) - unverifiedCount(b) || a.testName.localeCompare(b.testName));
  const current = series.find((s) => s.key === selected) ?? byPoints[0] ?? series[0];
  const docTitle = (id: string) => ws.state.documents.find((d) => d.id === id)?.title ?? "Record";

  return (
    <div>
      <PageHeader title="Compare results over time" subtitle="Values are only compared when the test and the unit match. Each point keeps the reference interval from its own report." />
      {series.length === 0 ? (
        <Card>
          <EmptyState icon={<LineIcon className="h-6 w-6" />} title="No results to compare yet" action={<ButtonLink href="/app/documents/upload">Upload a lab report</ButtonLink>}>
            Upload two or more reports with the same test to see how the recorded values changed.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid-cols-1 [&>*]:min-w-0 gap-6 lg:grid-cols-[260px_1fr]">
          <nav aria-label="Tests" className="hidden lg:block">
            <ul className="space-y-1">
              {series.map((s) => (
                <li key={s.key}>
                  <button onClick={() => setSelected(s.key)} aria-current={current?.key === s.key} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${current?.key === s.key ? "bg-pine-soft font-medium text-pine" : "hover:bg-sunken"}`}>
                    <span className="truncate">
                      {s.testName} <span className="text-muted">({s.unit})</span>
                    </span>
                    <span className="text-xs text-muted">{s.points.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="min-w-0 space-y-5">
            <label className="block lg:hidden">
              <span className="text-sm font-medium">Test</span>
              <Select value={current?.key} onChange={(e) => setSelected(e.target.value)} className="mt-1">
                {series.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.testName} ({s.unit}) · {s.points.length}
                  </option>
                ))}
              </Select>
            </label>
            {current && <SeriesView s={current} docTitle={docTitle} locale={ws.state.settings.locale} />}
            {incomparable.length > 0 && (
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Unlink className="h-5 w-5 text-warn" aria-hidden /> Not compared: different units
                </h2>
                <ul className="mt-3 space-y-3 text-sm">
                  {incomparable.map((i) => (
                    <li key={i.testName}>
                      <p className="font-medium">{i.testName}</p>
                      <p className="text-ink-2">
                        Recorded in {i.units.join(" and ")}. These are shown separately because HealthOS doesn’t convert units without a validated conversion. Your clinician can tell you how they relate.
                      </p>
                      <ul className="mt-1 text-muted">
                        {i.observations.map((o) => (
                          <li key={o.id}>
                            {formatDate(o.observedOn, ws.state.settings.locale)}: {o.valueText} {o.unit ?? "(no unit)"} –{" "}
                            <Link href={`/app/documents/${o.documentId}`} className="text-pine underline">
                              {docTitle(o.documentId)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SeriesView({ s, docTitle, locale }: { s: ComparableSeries; docTitle: (id: string) => string; locale: string }) {
  const data = s.points.filter((p) => p.value !== null).map((p) => ({ date: p.observedOn ?? "", value: p.value, label: formatDate(p.observedOn, locale) }));
  const refs = new Set(s.points.map((p) => `${p.refLow}-${p.refHigh}`));
  const sharedRef = refs.size === 1 && s.points[0].refLow !== undefined && s.points[0].refHigh !== undefined ? s.points[0] : null;
  const last = s.points.at(-1)!;
  const prev = s.points.at(-2);
  const summary = prev ? describeChange(prev, last) : "Only one result is recorded for this test, so there’s nothing to compare yet.";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">{s.testName}</h2>
          <p className="text-sm text-muted">
            {s.points.length} result{s.points.length > 1 ? "s" : ""} in {s.unit}
          </p>
        </div>
        <Badge tone="neutral" icon={false}>
          A trend is not a diagnosis
        </Badge>
      </div>
      <p className="mt-4 rounded-2xl bg-sunken px-4 py-3 text-[0.95rem]">{summary}</p>

      {data.length > 1 && (
        <figure className="mt-5">
          <div className="h-64 w-full" aria-hidden>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                {sharedRef && <ReferenceArea y1={sharedRef.refLow} y2={sharedRef.refHigh} fill="var(--color-pine)" fillOpacity={0.08} stroke="none" />}
                <XAxis dataKey="label" tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--color-line)" }} />
                <YAxis tick={{ fill: "var(--color-muted)", fontSize: 12 }} tickLine={false} axisLine={false} width={48} domain={sharedRef ? [(min: number) => Math.min(min, sharedRef.refLow!), (max: number) => Math.max(max, sharedRef.refHigh!)] : ["auto", "auto"]} />
                <Tooltip contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: 12, color: "var(--color-ink)" }} formatter={(v) => [`${v} ${s.unit}`, s.testName]} />
                <Line type="monotone" dataKey="value" stroke="var(--color-pine)" strokeWidth={2.5} dot={{ r: 5, fill: "var(--color-surface)", strokeWidth: 2.5 }} activeDot={{ r: 7 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <figcaption className="mt-2 text-xs text-muted">
            {sharedRef ? `Shaded band: the laboratory reference interval (${sharedRef.refText}) printed on every report.` : "Reference intervals differ between reports, so none is shaded. See each report’s interval below."}
          </figcaption>
        </figure>
      )}

      {s.notes.map((n) => (
        <Callout key={n} tone="info" className="mt-4">
          {n}
        </Callout>
      ))}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">All {s.testName} results</caption>
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Result</th>
              <th className="py-2 pr-3 font-medium">Lab interval</th>
              <th className="py-2 pr-3 font-medium">Change</th>
              <th className="py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {s.points
              .map((p, i) => ({ p, prev: s.points[i - 1] }))
              .reverse()
              .map(({ p, prev }) => (
                <tr key={p.id} className="border-b border-line/70 align-top">
                  <td className="py-2.5 pr-3">{formatDate(p.observedOn, locale)}</td>
                  <td className="py-2.5 pr-3 font-medium tabular-nums">
                    {p.valueText} {p.unit}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.flag && <Badge tone="neutral">Lab flag {p.flag}</Badge>}
                      {p.verification === "extracted" && p.reviewReasons.length > 0 && <Badge tone="warn">Unverified</Badge>}
                      {p.verification === "corrected" && <Badge tone="info">Corrected</Badge>}
                      {p.verification === "extracted" && p.reviewReasons.length === 0 && <Badge tone="neutral" icon={false}>OCR/text extracted</Badge>}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-ink-2">{p.refText ?? "Not printed"}</td>
                  <td className="py-2.5 pr-3 text-ink-2 tabular-nums">{prev && prev.value !== null && p.value !== null ? `${p.value - prev.value > 0 ? "+" : ""}${Math.round((p.value - prev.value) * 100) / 100}` : "—"}</td>
                  <td className="py-2.5">
                    <Link href={`/app/documents/${p.documentId}#obs-${p.id}`} className="text-pine underline underline-offset-2">
                      {docTitle(p.documentId)}
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
