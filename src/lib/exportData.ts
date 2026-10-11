import type { AppState, ID } from "./types";

/** Structured export of selected records for one profile. Original values and their verification state are preserved. */
export function buildExport(state: AppState, profileId: ID, opts: { documentIds: ID[]; includeMedications: boolean; includeAppointments: boolean }) {
  const profile = state.profiles.find((p) => p.id === profileId);
  const docs = state.documents.filter((d) => d.profileId === profileId && opts.documentIds.includes(d.id));
  return {
    format: "healthos-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    demoData: state.mode === "demo",
    profile: profile && { name: profile.displayName, dateOfBirth: profile.dateOfBirth },
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      date: d.documentDate,
      provider: d.provider,
      fileName: d.fileName,
      status: d.status,
      results: state.observations
        .filter((o) => o.documentId === d.id)
        .map((o) => ({
          test: o.testName,
          value: o.valueText,
          unit: o.unit ?? null,
          referenceInterval: o.refText ?? null,
          labFlag: o.flag ?? null,
          verification: o.verification,
          needsReview: o.verification === "extracted" && o.reviewReasons.length > 0,
          sourceLine: o.sourceLine,
          history: o.history,
        })),
    })),
    medications: opts.includeMedications
      ? state.medicines
          .filter((m) => m.profileId === profileId)
          .map((m) => ({ name: m.name, strength: m.strength, dose: m.dose, route: m.route, frequency: m.frequencyText, times: m.schedule.times, startDate: m.schedule.startDate, endDate: m.schedule.endDate, status: m.status, instructions: m.instructions, prescriber: m.prescriber }))
      : undefined,
    appointments: opts.includeAppointments
      ? state.appointments.filter((a) => a.profileId === profileId).map((a) => ({ title: a.title, type: a.type, startsAt: a.startsAt, provider: a.provider, location: a.location, status: a.status }))
      : undefined,
  };
}
