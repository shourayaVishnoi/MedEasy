import { createDemoState } from "@/lib/demo/seed";
import { ingestText } from "@/lib/ingest";
import type { AppState, MedicalDocument } from "@/lib/types";

export function demo(): AppState {
  return createDemoState(new Date("2026-10-10T09:00:00Z"), "UTC");
}

export function labDoc(profileId: string, text: string, id = "doc_x", date = "2026-10-01"): MedicalDocument {
  return { id, profileId, title: "Test report", category: "lab_report", documentDate: date, tags: [], uploadedAt: "2026-10-01T00:00:00Z", fileName: "r.txt", mimeType: "text/plain", sizeBytes: text.length, status: "uploaded" };
}

export function addLab(state: AppState, profileId: string, text: string, id: string, date: string) {
  const r = ingestText(labDoc(profileId, text, id, date), [text]);
  state.documents.push(r.document);
  state.observations.push(...r.observations);
  return r;
}
