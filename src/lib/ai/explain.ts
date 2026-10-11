import type { LabObservation, MedicalDocument } from "../types";
import { GENERAL_TERMS, TEST_GLOSSARY } from "./glossary";
import { relationToInterval } from "../reports/compare";

export type ExplainMode = "simple" | "detailed" | "result" | "terms" | "summary" | "questions" | "language";

export const EXPLAIN_MODES: { id: ExplainMode; label: string }[] = [
  { id: "simple", label: "Explain simply" },
  { id: "detailed", label: "Explain in detail" },
  { id: "result", label: "Explain one result" },
  { id: "terms", label: "Explain the terms" },
  { id: "summary", label: "Summarize the report" },
  { id: "language", label: "Another language" },
  { id: "questions", label: "Questions for my doctor" },
];

export type SectionKind = "documented" | "general" | "unknown" | "questions" | "notice";

export interface Citation {
  documentId: string;
  page?: number;
  line?: string;
}

export interface ExplanationItem {
  text: string;
  citation?: Citation;
  uncertain?: boolean;
}

export interface ExplanationSection {
  kind: SectionKind;
  heading: string;
  items: ExplanationItem[];
}

export interface Explanation {
  mode: ExplainMode;
  sections: ExplanationSection[];
  engine: "built-in";
}

const KIND_HEADING: Record<SectionKind, string> = {
  documented: "From your report",
  general: "General information",
  unknown: "What this report alone can't tell you",
  questions: "Questions you could ask your doctor",
  notice: "Please note",
};

function cite(o: LabObservation): Citation {
  return { documentId: o.documentId, page: o.page, line: o.sourceLine };
}

function valueWithUnit(o: LabObservation): string {
  return `${o.valueText}${o.unit ? ` ${o.unit}` : " (no unit on the report)"}`;
}

export function describeObservation(o: LabObservation, detailed: boolean): ExplanationItem {
  const uncertain = o.verification === "extracted" && o.reviewReasons.length > 0;
  const parts = [`${o.testName}: ${valueWithUnit(o)}.`];
  if (o.refText) parts.push(`The laboratory's reference interval on this report is ${o.refText}${o.unit ? ` ${o.unit}` : ""}.`);
  else parts.push("No reference interval is printed for this test, so MedEasy does not supply one.");
  if (o.flag) parts.push(`The laboratory flagged it as ${o.flag === "H" ? "high (H)" : "low (L)"}.`);
  else if (o.refText) {
    const rel = relationToInterval(o);
    if (rel === "above" || rel === "below")
      parts.push(`The value is ${rel} the printed interval, although the laboratory did not add a flag on this line.`);
    else if (rel === "within") parts.push("The value is within the printed interval and the laboratory did not flag it.");
  }
  if (detailed && o.verification !== "extracted") parts.push(o.verification === "corrected" ? "You corrected this value after extraction." : "You confirmed this value.");
  if (uncertain) parts.push(`This value has not been verified yet: ${o.reviewReasons.join("; ")}.`);
  return { text: parts.join(" "), citation: cite(o), uncertain };
}

function generalFor(o: LabObservation, detailed: boolean): ExplanationItem[] {
  const info = TEST_GLOSSARY[o.testKey];
  if (!info) return [{ text: `MedEasy has no reviewed background information for "${o.testName}" yet.` }];
  const items = [{ text: info.measures }];
  if (detailed) items.push({ text: info.cannotEstablish });
  return items;
}

function questionsFor(observations: LabObservation[]): ExplanationItem[] {
  const qs: ExplanationItem[] = [];
  for (const o of observations) {
    const rel = relationToInterval(o);
    if (o.flag || rel === "above" || rel === "below") {
      qs.push({ text: `My ${o.testName} was ${valueWithUnit(o)}${o.flag ? ` and flagged ${o.flag}` : ""}. What could explain this, and does it need follow-up?`, citation: cite(o) });
    }
  }
  if (observations.some((o) => !o.refText)) qs.push({ text: "Some results have no reference interval printed. Which interval applies to me for those tests?" });
  if (observations.some((o) => o.reviewReasons.length > 0 && o.verification === "extracted"))
    qs.push({ text: "Could you confirm a few values I wasn't able to read clearly on the report?" });
  qs.push({ text: "Should any of these tests be repeated, and when?" });
  qs.push({ text: "How do these results fit with my symptoms, medicines and history?" });
  return qs;
}

export function explainReport(
  doc: MedicalDocument,
  observations: LabObservation[],
  mode: ExplainMode,
  focusTestKey?: string,
): Explanation {
  const obs = observations.filter((o) => o.documentId === doc.id);
  const sections: ExplanationSection[] = [];
  const add = (kind: SectionKind, items: ExplanationItem[], heading = KIND_HEADING[kind]) => {
    if (items.length) sections.push({ kind, heading, items });
  };

  if (obs.length === 0) {
    add("unknown", [
      {
        text:
          doc.status === "failed"
            ? "Text could not be extracted from this document, so there is nothing to explain yet. Your original file is safe; you can retry processing or enter results manually."
            : "No test results were found in this document's text. MedEasy will not guess at its contents.",
      },
    ]);
    return { mode, sections, engine: "built-in" };
  }

  const unverified = obs.filter((o) => o.verification === "extracted" && o.reviewReasons.length > 0);
  if (unverified.length)
    add("notice", [{ text: `${unverified.length} value${unverified.length > 1 ? "s are" : " is"} not verified yet. They are marked below; please check them against the original before relying on them.`, uncertain: true }]);

  switch (mode) {
    case "simple":
    case "detailed": {
      const detailed = mode === "detailed";
      add("documented", obs.map((o) => describeObservation(o, detailed)));
      const seen = new Set<string>();
      const general: ExplanationItem[] = [];
      for (const o of obs) {
        if (seen.has(o.testKey)) continue;
        seen.add(o.testKey);
        for (const g of generalFor(o, detailed)) general.push({ text: `${TEST_GLOSSARY[o.testKey]?.name ?? o.testName}: ${g.text}` });
      }
      add("general", general);
      add("unknown", [
        { text: "Whether these results mean anything for your health on their own. Results are interpreted together with your history, symptoms, medicines and other tests." },
        ...(detailed ? [{ text: "Reference intervals depend on the laboratory, its methods, and factors such as age, sex and pregnancy. MedEasy keeps the interval printed on this report." }] : []),
      ]);
      add("questions", questionsFor(obs).slice(0, detailed ? 6 : 3));
      break;
    }
    case "result": {
      const o = obs.find((x) => x.testKey === focusTestKey) ?? obs[0];
      add("documented", [describeObservation(o, true)]);
      add("general", generalFor(o, true));
      add("unknown", [{ text: TEST_GLOSSARY[o.testKey]?.cannotEstablish ?? "What this single result means for you. That needs clinical context." }]);
      add("questions", questionsFor([o]).slice(0, 3));
      break;
    }
    case "terms": {
      const items: ExplanationItem[] = [];
      for (const [term, def] of Object.entries(GENERAL_TERMS)) items.push({ text: `${term}: ${def}` });
      for (const o of obs) {
        const info = TEST_GLOSSARY[o.testKey];
        if (info?.terms) for (const [t, d] of Object.entries(info.terms)) if (!items.some((i) => i.text.startsWith(`${t}:`))) items.push({ text: `${t}: ${d}` });
      }
      add("general", items, "Terms on this report");
      break;
    }
    case "summary": {
      const flagged = obs.filter((o) => o.flag || ["above", "below"].includes(relationToInterval(o)));
      add("documented", [
        { text: `${doc.title}${doc.documentDate ? `, dated ${doc.documentDate}` : ""}${doc.provider ? `, from ${doc.provider}` : ""}. ${obs.length} result${obs.length > 1 ? "s" : ""} found.` , citation: { documentId: doc.id, page: 1 } },
        { text: flagged.length ? `${flagged.length} result${flagged.length > 1 ? "s are" : " is"} flagged or outside the printed interval: ${flagged.map((o) => `${o.testName} ${valueWithUnit(o)}`).join(", ")}.` : "No results are flagged or outside the printed intervals." },
        ...(obs.some((o) => !o.refText) ? [{ text: `No reference interval is printed for: ${obs.filter((o) => !o.refText).map((o) => o.testName).join(", ")}.` }] : []),
      ]);
      add("unknown", [{ text: "This summary lists what the report says. It is not an assessment of your health." }]);
      break;
    }
    case "questions":
      add("questions", questionsFor(obs));
      break;
    case "language":
      add("notice", [
        {
          text: "Translated explanations need an AI provider to be configured (see the setup guide). The built-in engine only explains in English so that clinical values and terminology are never mistranslated.",
        },
      ]);
      add("documented", obs.map((o) => describeObservation(o, false)));
      break;
  }
  return { mode, sections, engine: "built-in" };
}
