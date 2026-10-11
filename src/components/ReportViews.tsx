"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, Check, CircleHelp, FileSearch, Loader2, MessageCircleQuestion, Pencil, Sparkles } from "lucide-react";
import type { LabObservation, MedicalDocument } from "@/lib/types";
import { EXPLAIN_MODES, explainReport, type ExplainMode, type ExplanationSection } from "@/lib/ai/explain";
import { confirmObservation, correctObservation } from "@/lib/actions";
import { relationToInterval } from "@/lib/reports/compare";
import { Badge, Button, Callout, Field, Input, Select, toast } from "./ui";
import { cx } from "@/lib/util";

const SECTION_STYLE: Record<ExplanationSection["kind"], { icon: React.ReactNode; className: string }> = {
  documented: { icon: <FileSearch className="h-4 w-4" aria-hidden />, className: "border-pine/25" },
  general: { icon: <BookOpen className="h-4 w-4" aria-hidden />, className: "border-line" },
  unknown: { icon: <CircleHelp className="h-4 w-4" aria-hidden />, className: "border-line border-dashed" },
  questions: { icon: <MessageCircleQuestion className="h-4 w-4" aria-hidden />, className: "border-line" },
  notice: { icon: <AlertTriangle className="h-4 w-4" aria-hidden />, className: "border-warn/30 bg-warn-soft/50" },
};

export function ExplanationView({ doc, observations, onCite, language }: { doc: MedicalDocument; observations: LabObservation[]; onCite: (line?: string) => void; language: string }) {
  const [mode, setMode] = useState<ExplainMode>("simple");
  const [focus, setFocus] = useState<string>(observations[0]?.testKey ?? "");
  const [ai, setAi] = useState<{ text: string } | null>(null);
  const [aiState, setAiState] = useState<"idle" | "loading" | "unavailable" | "error">("idle");
  const [lang, setLang] = useState(language === "en" ? "Hindi" : language);
  const exp = explainReport(doc, observations, mode, focus);

  async function askProvider() {
    setAiState("loading");
    setAi(null);
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          language: mode === "language" ? lang : "English",
          focusTest: mode === "result" ? observations.find((o) => o.testKey === focus)?.testName : undefined,
          document: { id: doc.id, title: doc.title, date: doc.documentDate, pages: doc.pages ?? [] },
        }),
      });
      if (res.status === 503) {
        setAiState("unavailable");
        return;
      }
      if (!res.ok) throw new Error();
      setAi(await res.json());
      setAiState("idle");
    } catch {
      setAiState("error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Explanation mode">
        {EXPLAIN_MODES.map((m) => (
          <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => { setMode(m.id); setAi(null); }} className={cx("rounded-full border px-3 py-1.5 text-sm font-medium transition", mode === m.id ? "border-pine bg-pine text-on-pine" : "border-line bg-surface text-ink-2 hover:bg-sunken")}>
            {m.label}
          </button>
        ))}
      </div>
      {mode === "result" && (
        <Field label="Which result?">
          {(id) => (
            <Select id={id} value={focus} onChange={(e) => setFocus(e.target.value)} className="max-w-sm">
              {observations.map((o) => (
                <option key={o.id} value={o.testKey}>
                  {o.testName}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      {mode === "language" && (
        <Field label="Language">{(id) => <Input id={id} value={lang} onChange={(e) => setLang(e.target.value)} className="max-w-xs" />}</Field>
      )}

      <div className="space-y-3">
        {exp.sections.map((s, i) => (
          <section key={i} className={cx("rounded-2xl border bg-surface p-4", SECTION_STYLE[s.kind].className)} aria-label={s.heading}>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-accent">{SECTION_STYLE[s.kind].icon}</span>
              {s.heading}
              {s.kind === "general" && <Badge tone="neutral" icon={false}>Not specific to you</Badge>}
            </h3>
            <ul className="mt-2 space-y-2.5">
              {s.items.map((it, j) => (
                <li key={j} className="text-[0.95rem] leading-relaxed text-ink-2">
                  {it.uncertain && <Badge tone="warn" className="mr-1.5 align-middle">Unverified</Badge>}
                  {it.text}
                  {it.citation?.line && (
                    <button onClick={() => onCite(it.citation?.line)} className="ml-1.5 inline-flex items-center gap-1 rounded-md bg-sunken px-1.5 py-0.5 align-middle text-xs font-medium text-accent hover:underline">
                      Source: page {it.citation.page ?? 1}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-sunken/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            <Sparkles className="mr-1 inline h-4 w-4 text-accent" aria-hidden /> The explanation above uses MedEasy’s built-in, rule-based engine. You can also ask the configured AI provider.
          </p>
          <Button size="sm" variant="secondary" onClick={askProvider} disabled={aiState === "loading"}>
            {aiState === "loading" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Ask AI provider
          </Button>
        </div>
        {aiState === "unavailable" && <p className="mt-3 text-sm text-warn">No AI provider is configured for this deployment, so nothing was sent. The built-in explanation above is still available.</p>}
        {aiState === "error" && <p className="mt-3 text-sm text-danger">The AI service didn’t respond. Your report is safe and unchanged. You can try again later.</p>}
        {ai && (
          <div className="mt-3 whitespace-pre-wrap rounded-xl bg-surface p-4 text-[0.95rem] leading-relaxed">
            <Badge tone="info" className="mb-2">AI-generated · check against your report</Badge>
            <div>{ai.text}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function confidenceLabel(c: number) {
  if (c >= 0.9) return { label: "High confidence", tone: "neutral" as const };
  if (c >= 0.7) return { label: "Medium confidence", tone: "warn" as const };
  return { label: "Low confidence", tone: "warn" as const };
}

export function ResultsReview({ observations, onCite }: { observations: LabObservation[]; onCite: (line?: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <ul className="space-y-3">
      {observations.map((o) => {
        const pending = o.verification === "extracted" && (o.reviewReasons.length > 0 || o.confidence < 0.8);
        const conf = confidenceLabel(o.confidence);
        const rel = relationToInterval(o);
        return (
          <li key={o.id} id={`obs-${o.id}`} className={cx("scroll-mt-24 rounded-2xl border bg-surface p-4", pending ? "border-warn/40" : "border-line")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-muted">{o.testName}</p>
                <p className="text-xl font-semibold tabular-nums">
                  {o.valueText} <span className="text-base font-normal text-muted">{o.unit ?? "— no unit"}</span>
                </p>
                <p className="mt-0.5 text-sm text-ink-2">
                  {o.refText ? `Lab reference interval: ${o.refText}` : "No reference interval on the report"}
                  {o.flag && ` · Lab flag: ${o.flag === "H" ? "High" : "Low"}`}
                  {!o.flag && (rel === "above" || rel === "below") && ` · ${rel} printed interval (no lab flag)`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {o.verification === "confirmed" && <Badge tone="ok">Confirmed by you</Badge>}
                {o.verification === "corrected" && <Badge tone="ok" icon={<Pencil className="h-3 w-3" />}>Corrected by you</Badge>}
                {o.verification === "extracted" && (pending ? <Badge tone="warn">Needs review</Badge> : <Badge tone="neutral">Extracted</Badge>)}
                <Badge tone={conf.tone} icon={false}>
                  {conf.label}
                </Badge>
              </div>
            </div>
            {pending && (
              <ul className="mt-2 space-y-1">
                {o.reviewReasons.map((r) => (
                  <li key={r} className="flex items-start gap-1.5 text-sm text-warn">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {r}
                  </li>
                ))}
              </ul>
            )}
            {o.sourceLine && (
              <button onClick={() => onCite(o.sourceLine)} className="mt-2 block max-w-full truncate rounded-lg bg-sunken px-2.5 py-1.5 text-left font-mono text-[0.78rem] text-ink-2 hover:underline">
                Page {o.page ?? 1}: “{o.sourceLine}”
              </button>
            )}
            {editing === o.id ? (
              <CorrectForm o={o} onDone={() => setEditing(null)} />
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {o.verification === "extracted" && (
                  <Button size="sm" variant={pending ? "primary" : "secondary"} onClick={() => { confirmObservation(o.id); toast(`${o.testName} confirmed`); }}>
                    <Check className="h-4 w-4" aria-hidden /> Matches the original
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing(o.id)}>
                  <Pencil className="h-4 w-4" aria-hidden /> Correct
                </Button>
              </div>
            )}
            {o.history.length > 1 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted">Change history ({o.history.length})</summary>
                <ol className="mt-2 space-y-1">
                  {o.history.map((h, i) => (
                    <li key={i} className="text-ink-2">
                      {h.by === "extraction" ? "Extracted" : "Corrected"}: <span className="font-mono">{h.value}</span> · {new Date(h.at).toLocaleString()}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CorrectForm({ o, onDone }: { o: LabObservation; onDone: () => void }) {
  const [value, setValue] = useState(o.valueText);
  const [unit, setUnit] = useState(o.unit ?? "");
  const [ref, setRef] = useState(o.refText ?? "");
  const [err, setErr] = useState<string>();
  return (
    <form
      className="mt-3 grid gap-3 rounded-xl bg-sunken p-3 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^[<>]?\s*\d+(?:[.,]\d+)*$/.test(value.trim())) return setErr("Enter the number exactly as printed.");
        correctObservation(o.id, value.trim(), unit.trim() || undefined, ref.trim() || undefined);
        toast("Correction saved; the original extraction is kept in history");
        onDone();
      }}
    >
      <Field label="Value" error={err}>{(id, d) => <Input id={id} aria-describedby={d} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />}</Field>
      <Field label="Unit">{(id) => <Input id={id} value={unit} onChange={(e) => setUnit(e.target.value)} />}</Field>
      <Field label="Reference interval">{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="As printed" />}</Field>
      <div className="flex items-end gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted sm:col-span-4">Copy the values exactly as printed on the original report. MedEasy keeps the extracted version in the history.</p>
      <Callout tone="neutral" className="sm:col-span-4">Only correct what the document says. Don’t enter values from memory or another report.</Callout>
    </form>
  );
}
