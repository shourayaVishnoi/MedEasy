import type { AppState, ID, LabObservation } from "../types";
import { explainReport } from "./explain";
import { asksForMedicationChange, detectUrgent, MED_CHANGE_GUIDANCE, URGENT_GUIDANCE } from "./safety";
import { searchRecords } from "../search";
import { describeChange } from "../reports/compare";
import { normalizeUnit } from "../extraction/labParser";

export interface AnswerItem {
  text: string;
  documentId?: ID;
  href?: string;
  label?: string;
}

export interface AssistantAnswer {
  urgent?: string;
  boundary?: string;
  documented: AnswerItem[];
  general: AnswerItem[];
  unknown: AnswerItem[];
  engine: "built-in";
}

/**
 * Built-in, retrieval-only assistant. It answers from the records of the
 * active profile only, cites the source of every documented statement, and
 * treats document text strictly as data (it never acts on it).
 */
export function answerQuestion(state: AppState, profileId: ID, question: string, now = new Date()): AssistantAnswer {
  const a: AssistantAnswer = { documented: [], general: [], unknown: [], engine: "built-in" };
  const q = question.trim();
  if (detectUrgent(q)) {
    a.urgent = URGENT_GUIDANCE;
    return a;
  }
  if (asksForMedicationChange(q)) a.boundary = MED_CHANGE_GUIDANCE;

  const docs = state.documents.filter((d) => d.profileId === profileId);
  const obs = state.observations.filter((o) => o.profileId === profileId);
  const meds = state.medicines.filter((m) => m.profileId === profileId);
  const appts = state.appointments.filter((x) => x.profileId === profileId);
  const docTitle = (id: ID) => docs.find((d) => d.id === id)?.title ?? "document";
  const lower = q.toLowerCase();

  if (/\b(hindi|tamil|bengali|telugu|marathi|spanish|french|translate|another language)\b/.test(lower)) {
    a.unknown.push({ text: "Explanations in other languages need an AI provider to be configured. The built-in engine answers in English so values and medical terms are never mistranslated." });
  }

  // Medicines
  if (/\bmedicine|medication|tablet|pill|drug|taking\b/.test(lower) && !a.boundary) {
    const active = meds.filter((m) => m.status === "active");
    if (active.length)
      for (const m of active)
        a.documented.push({
          text: `${m.name}${m.strength ? ` ${m.strength}` : ""}: ${m.dose}${m.frequencyText ? `, ${m.frequencyText}` : ""} at ${m.schedule.times.join(", ")}${m.prescriber ? ` (prescribed by ${m.prescriber})` : ""}. Recorded as active.`,
          href: `/app/medicines#med-${m.id}`,
          label: "Medicine schedule",
        });
    else a.unknown.push({ text: "No medicines are recorded as active for this profile." });
    a.unknown.push({ text: "This list only includes medicines entered in MedEasy. It may not match everything you actually take." });
  }
  if (a.boundary) {
    const named = meds.filter((m) => lower.includes(m.name.toLowerCase()));
    for (const m of named) a.documented.push({ text: `Your record for ${m.name}: ${m.dose}${m.frequencyText ? `, ${m.frequencyText}` : ""}. Instructions: ${m.instructions ?? "none recorded"}.`, href: `/app/medicines#med-${m.id}`, label: "Medicine schedule" });
  }

  // Appointments
  if (/\bappointment|visit|consultation|follow[-\s]?up\b/.test(lower)) {
    const upcoming = appts.filter((x) => x.status === "upcoming" && new Date(x.startsAt) >= now).sort((x, y) => x.startsAt.localeCompare(y.startsAt));
    if (upcoming[0]) {
      const n = upcoming[0];
      a.documented.push({ text: `Next: ${n.title} on ${new Date(n.startsAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}${n.provider ? ` with ${n.provider}` : ""}${n.location ? ` at ${n.location}` : ""}.`, href: `/app/appointments#appt-${n.id}`, label: "Appointment" });
      if (/\bbring|take|prepare\b/.test(lower)) {
        const recent = docs.filter((d) => d.category === "lab_report" || d.category === "prescription").sort((x, y) => (y.documentDate ?? "").localeCompare(x.documentDate ?? "")).slice(0, 4);
        for (const d of recent) a.documented.push({ text: `Consider bringing: ${d.title}${d.documentDate ? ` (${d.documentDate})` : ""}.`, documentId: d.id, href: `/app/documents/${d.id}`, label: d.title });
        for (const rd of n.relatedDocumentIds) a.documented.push({ text: `Linked to this appointment: ${docTitle(rd)}.`, documentId: rd, href: `/app/documents/${rd}`, label: docTitle(rd) });
        a.unknown.push({ text: "Which records your clinician actually needs. If unsure, ask the clinic when you confirm the appointment." });
      }
    } else a.unknown.push({ text: "No upcoming appointment is recorded for this profile." });
  }

  // Specific tests mentioned
  const testKeys = [...new Set(obs.map((o) => o.testKey))].filter((k) => {
    const name = obs.find((o) => o.testKey === k)!.testName.toLowerCase();
    return lower.includes(name) || lower.replace(/[^a-z0-9]/g, "").includes(k);
  });
  for (const key of testKeys) {
    const series = obs.filter((o) => o.testKey === key).sort((x, y) => (x.observedOn ?? "").localeCompare(y.observedOn ?? ""));
    for (const o of series) a.documented.push(obsItem(o, docTitle(o.documentId)));
    // Conflicting values recorded for the same test on the same date are both shown.
    const byDate = new Map<string, LabObservation[]>();
    for (const o of series) byDate.set(o.observedOn ?? "?", [...(byDate.get(o.observedOn ?? "?") ?? []), o]);
    for (const [date, same] of byDate)
      if (same.length > 1 && new Set(same.map((s) => s.valueText)).size > 1)
        a.documented.push({ text: `Your records disagree for ${same[0].testName} on ${date}: ${same.map((s) => `${s.valueText} ${s.unit ?? ""} in "${docTitle(s.documentId)}"`).join(" vs ")}. MedEasy shows both rather than choosing one.` });
    const comparable = series.filter((s) => normalizeUnit(s.unit) === normalizeUnit(series.at(-1)!.unit));
    if (comparable.length > 1) a.documented.push({ text: describeChange(comparable.at(-2)!, comparable.at(-1)!) });
    if (new Set(series.map((s) => normalizeUnit(s.unit))).size > 1) a.unknown.push({ text: `Some ${series[0].testName} results use different units, so they are not compared directly.` });
    a.unknown.push({ text: "A trend in recorded values is not a diagnosis. Your clinician can say what it means for you." });
  }

  // Latest report / summary / questions
  const latestLab = docs.filter((d) => d.category === "lab_report").sort((x, y) => (y.documentDate ?? "").localeCompare(x.documentDate ?? ""))[0];
  const wantsSummary = /\b(latest|recent|last)\b.*\b(report|blood|test|result)s?\b|\bsummar/.test(lower);
  const wantsQuestions = /\bquestions?\b/.test(lower);
  if ((wantsSummary || wantsQuestions) && testKeys.length === 0) {
    if (latestLab) {
      const exp = explainReport(latestLab, obs, wantsQuestions ? "questions" : "summary");
      for (const s of exp.sections) {
        const items = s.items.map((i) => ({ text: i.text, documentId: latestLab.id, href: `/app/documents/${latestLab.id}`, label: latestLab.title }));
        if (s.kind === "documented" || s.kind === "questions" || s.kind === "notice") a.documented.push(...items);
        else if (s.kind === "general") a.general.push(...items);
        else a.unknown.push(...items);
      }
    } else a.unknown.push({ text: "No laboratory reports have been uploaded for this profile yet." });
  }

  // Fallback: plain search
  if (!a.documented.length && !a.urgent && !a.boundary) {
    const hits = searchRecords(state, q.replace(/[?.,!]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 2).join(" "), [profileId]).slice(0, 5);
    for (const h of hits) a.documented.push({ text: `${h.title}${h.date ? ` (${h.date})` : ""} – ${h.subtitle}`, href: h.href, label: h.type });
    if (!hits.length) a.unknown.push({ text: "I couldn't find anything in this profile's records that answers that. MedEasy only answers from records you've added; it won't guess." });
  }
  return a;
}

function obsItem(o: LabObservation, title: string): AnswerItem {
  const unverified = o.verification === "extracted" && o.reviewReasons.length > 0;
  return {
    text: `${o.observedOn ?? "Undated"}: ${o.testName} ${o.valueText}${o.unit ? ` ${o.unit}` : ""}${o.refText ? ` (lab interval ${o.refText})` : " (no interval printed)"}${o.flag ? `, flagged ${o.flag}` : ""}${unverified ? " – not yet verified" : ""}.`,
    documentId: o.documentId,
    href: `/app/documents/${o.documentId}#obs-${o.id}`,
    label: `${title}${o.page ? `, page ${o.page}` : ""}`,
  };
}
