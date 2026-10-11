import type { DocumentCategory, LabObservation, MedicalDocument, Prescription } from "./types";
import { needsReview, parseLabReport } from "./extraction/labParser";
import { parsePrescription, parseReportDateSafe } from "./extraction/index";
import { uid } from "./util";

export interface IngestResult {
  document: MedicalDocument;
  observations: LabObservation[];
  prescription?: Prescription;
}

/** Detect a likely document type from its text. The user can always change it. */
export function detectCategory(text: string, fileName = ""): DocumentCategory {
  const t = `${fileName}\n${text}`.toLowerCase();
  if (/\b(rx|prescription|tab\.?|cap\.?|syp\.?)\b/.test(t) && /\b(mg|ml|daily|bd|od|tds)\b/.test(t)) return "prescription";
  if (/\b(reference|ref\.? range|interval|haemoglobin|hemoglobin|tsh|hba1c|cholesterol|laboratory|lab report)\b/.test(t)) return "lab_report";
  if (/\bdischarge\b/.test(t)) return "discharge";
  if (/\b(x-ray|mri|ct scan|ultrasound|impression)\b/.test(t)) return "imaging";
  if (/\b(vaccin|immuni[sz]ation|dose 1|booster)\b/.test(t)) return "vaccination";
  if (/\ballerg/.test(t)) return "allergy";
  if (/\b(invoice|bill|receipt|amount due)\b/.test(t)) return "bill";
  if (/\b(consultation|chief complaint|assessment|plan)\b/.test(t)) return "consultation";
  return "other";
}

/**
 * Run extraction on already-stored text. The document is marked "needs_review"
 * when any field is uncertain, and only "processed" once extraction has
 * actually produced and persisted results.
 */
export function ingestText(doc: MedicalDocument, pages: string[], opts: { ocr?: boolean } = {}): IngestResult {
  const text = pages.join("\n");
  const document: MedicalDocument = { ...doc, pages };
  const observations: LabObservation[] = [];
  let prescription: Prescription | undefined;

  if (doc.category === "lab_report") {
    const parsed = parseLabReport(pages, opts);
    const dateMeta = parsed.meta.find((m) => m.key === "documentDate");
    const labMeta = parsed.meta.find((m) => m.key === "laboratory");
    if (!document.documentDate && dateMeta?.normalized) document.documentDate = dateMeta.normalized;
    if (!document.provider && labMeta) document.provider = labMeta.value;
    for (const r of parsed.results) {
      observations.push({
        id: uid("obs"),
        profileId: doc.profileId,
        documentId: doc.id,
        testName: r.testName,
        testKey: r.testKey,
        valueText: r.valueText,
        value: r.value,
        unit: r.unit,
        refText: r.refText,
        refLow: r.refLow,
        refHigh: r.refHigh,
        flag: r.flag,
        observedOn: document.documentDate,
        page: r.page,
        sourceLine: r.sourceLine,
        confidence: r.confidence,
        reviewReasons: [...r.reviewReasons, ...(dateMeta?.reviewReasons ?? [])],
        verification: "extracted",
        history: [{ value: `${r.valueText}${r.unit ? ` ${r.unit}` : ""}`, at: new Date().toISOString(), by: "extraction" }],
      });
    }
    const uncertain = observations.some(needsReview) || (dateMeta?.reviewReasons.length ?? 0) > 0;
    document.status = observations.length === 0 ? "needs_review" : uncertain ? "needs_review" : "processed";
  } else if (doc.category === "prescription") {
    const parsed = parsePrescription(text);
    const date = parsed.date ? parseReportDateSafe(parsed.date) : undefined;
    prescription = {
      id: uid("rx"),
      profileId: doc.profileId,
      documentId: doc.id,
      prescriber: parsed.prescriber,
      prescribedOn: date,
      items: parsed.items.map((i) => ({
        id: uid("rxi"),
        medicineName: i.medicineName,
        strength: i.strength,
        dosageForm: i.dosageForm,
        dose: i.dose,
        route: i.route,
        frequencyText: i.frequencyText,
        foodInstruction: i.foodInstruction,
        durationText: i.durationText,
        sourceLine: i.sourceLine,
        confidence: i.confidence,
        reviewReasons: i.reviewReasons,
        verified: false,
      })),
      status: "draft",
      createdAt: new Date().toISOString(),
    };
    if (!document.documentDate && date) document.documentDate = date;
    if (!document.provider && parsed.prescriber) document.provider = parsed.prescriber;
    // Prescriptions always need the user to verify every field before scheduling.
    document.status = "needs_review";
  } else {
    document.status = "processed";
  }
  return { document, observations, prescription };
}
