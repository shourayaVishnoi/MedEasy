import type { AppState, DocumentCategory, ID } from "./types";

export type TimelineKind = "lab" | "consultation" | "prescription" | "medication" | "appointment" | "vaccination" | "hospital" | "document";

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  date: string;
  title: string;
  detail?: string;
  href: string;
  profileId: ID;
}

const KIND_BY_CATEGORY: Partial<Record<DocumentCategory, TimelineKind>> = {
  lab_report: "lab",
  consultation: "consultation",
  discharge: "hospital",
  vaccination: "vaccination",
  prescription: "prescription",
};

export const TIMELINE_LABEL: Record<TimelineKind, string> = {
  lab: "Lab report",
  consultation: "Consultation",
  prescription: "Prescription",
  medication: "Medication change",
  appointment: "Appointment",
  vaccination: "Vaccination",
  hospital: "Hospital record",
  document: "Document",
};

/** Chronological list of documented events. Each item links to its source; no causal links are inferred. */
export function buildTimeline(state: AppState, profileIds: ID[]): TimelineItem[] {
  const allowed = new Set(profileIds);
  const items: TimelineItem[] = [];
  for (const d of state.documents) {
    if (!allowed.has(d.profileId)) continue;
    items.push({
      id: `doc-${d.id}`,
      kind: KIND_BY_CATEGORY[d.category] ?? "document",
      date: d.documentDate ?? d.uploadedAt.slice(0, 10),
      title: d.title,
      detail: [d.provider, d.documentDate ? undefined : "Document date not recorded – shown by upload date"].filter(Boolean).join(" · "),
      href: `/app/documents/${d.id}`,
      profileId: d.profileId,
    });
  }
  for (const m of state.medicines) {
    if (!allowed.has(m.profileId)) continue;
    items.push({
      id: `med-start-${m.id}`,
      kind: "medication",
      date: m.schedule.startDate,
      title: `Started recording ${m.name}${m.strength ? ` ${m.strength}` : ""}`,
      detail: `${m.dose}${m.frequencyText ? ` · ${m.frequencyText}` : ""}${m.prescriber ? ` · ${m.prescriber}` : ""}`,
      href: `/app/medicines#med-${m.id}`,
      profileId: m.profileId,
    });
    if (m.schedule.endDate)
      items.push({ id: `med-end-${m.id}`, kind: "medication", date: m.schedule.endDate, title: `Schedule end date for ${m.name}`, href: `/app/medicines#med-${m.id}`, profileId: m.profileId });
  }
  for (const a of state.appointments) {
    if (!allowed.has(a.profileId)) continue;
    items.push({ id: `appt-${a.id}`, kind: a.type === "vaccination" ? "vaccination" : "appointment", date: a.startsAt.slice(0, 10), title: a.title, detail: [a.provider, a.status !== "upcoming" ? a.status : undefined].filter(Boolean).join(" · "), href: `/app/appointments#appt-${a.id}`, profileId: a.profileId });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}
