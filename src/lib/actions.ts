"use client";

import { getState, update } from "./store";
import type { Appointment, DoseStatus, HealthEntry, LabObservation, MedicalDocument, Medicine, Prescription, Profile, ShareLink } from "./types";
import type { DoseOccurrence } from "./meds/schedule";
import { secureToken, uid } from "./util";
import { deleteFile } from "./fileStore";

const now = () => new Date().toISOString();

// ---- Doses ----------------------------------------------------------------

export function logDose(occ: DoseOccurrence, status: DoseStatus, extra: { takenAt?: string; note?: string } = {}) {
  update(
    (s) => {
      const existing = s.doseLogs.find((l) => l.occurrenceKey === occ.key);
      const log = {
        id: existing?.id ?? uid("dl"),
        profileId: occ.profileId,
        medicineId: occ.medicineId,
        occurrenceKey: occ.key,
        scheduledFor: occ.scheduledFor.toISOString(),
        status,
        takenAt: status === "taken" ? (extra.takenAt ?? now()) : undefined,
        note: extra.note ?? existing?.note,
        recordedAt: now(),
      };
      // One log per occurrence: re-recording replaces, never duplicates.
      return { ...s, doseLogs: [...s.doseLogs.filter((l) => l.occurrenceKey !== occ.key), log] };
    },
    { action: "dose.recorded", detail: `Dose marked ${status}` },
  );
}

export function undoDose(occKey: string) {
  update((s) => ({ ...s, doseLogs: s.doseLogs.filter((l) => l.occurrenceKey !== occKey) }), { action: "dose.cleared", detail: "Dose record cleared" });
}

// ---- Documents --------------------------------------------------------------

export function addDocuments(docs: MedicalDocument[], observations: LabObservation[] = [], prescriptions: Prescription[] = []) {
  update(
    (s) => ({ ...s, documents: [...docs, ...s.documents], observations: [...s.observations, ...observations], prescriptions: [...s.prescriptions, ...prescriptions] }),
    { action: "document.uploaded", detail: `${docs.length} document(s) added` },
  );
}

export function replaceDocument(doc: MedicalDocument, observations: LabObservation[], prescription?: Prescription) {
  update(
    (s) => ({
      ...s,
      documents: s.documents.map((d) => (d.id === doc.id ? doc : d)),
      observations: [...s.observations.filter((o) => o.documentId !== doc.id), ...observations],
      prescriptions: prescription ? [...s.prescriptions.filter((p) => p.documentId !== doc.id || p.status === "verified"), prescription] : s.prescriptions,
    }),
    { action: "document.processed", detail: `Document processed (${doc.status})` },
  );
}

export function updateDocument(id: string, patch: Partial<MedicalDocument>) {
  update((s) => ({ ...s, documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) }), { action: "document.updated", detail: "Document details edited" });
}

export async function deleteDocument(doc: MedicalDocument) {
  if (doc.fileKey) await deleteFile(doc.fileKey);
  update(
    (s) => ({
      ...s,
      documents: s.documents.filter((d) => d.id !== doc.id),
      observations: s.observations.filter((o) => o.documentId !== doc.id),
      prescriptions: s.prescriptions.filter((p) => p.documentId !== doc.id || p.status === "verified"),
    }),
    { action: "document.deleted", detail: "Document deleted" },
  );
}

export function confirmObservation(id: string) {
  update(
    (s) => ({ ...s, observations: s.observations.map((o) => (o.id === id ? { ...o, verification: o.verification === "corrected" ? "corrected" : "confirmed" } : o)) }),
    { action: "observation.confirmed", detail: "Extracted value confirmed" },
  );
  syncDocStatus();
}

/** Correct a value. The original extraction stays in `history`; nothing is erased. */
export function correctObservation(id: string, valueText: string, unit: string | undefined, refText?: string) {
  update(
    (s) => ({
      ...s,
      observations: s.observations.map((o) => {
        if (o.id !== id) return o;
        const n = Number(valueText.replace(/,/g, ""));
        const range = refText?.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
        return {
          ...o,
          valueText,
          value: Number.isFinite(n) ? n : null,
          unit: unit || undefined,
          refText: refText ?? o.refText,
          refLow: range ? Number(range[1]) : o.refLow,
          refHigh: range ? Number(range[2]) : o.refHigh,
          verification: "corrected",
          history: [...o.history, { value: `${valueText}${unit ? ` ${unit}` : ""}`, at: now(), by: "user" }],
        };
      }),
    }),
    { action: "observation.corrected", detail: "Extracted value corrected by user" },
  );
  syncDocStatus();
}

function syncDocStatus() {
  update((s) => ({
    ...s,
    documents: s.documents.map((d) => {
      if (d.status !== "needs_review" || d.category !== "lab_report") return d;
      const obs = s.observations.filter((o) => o.documentId === d.id);
      const pending = obs.some((o) => o.verification === "extracted" && (o.reviewReasons.length > 0 || o.confidence < 0.8));
      return obs.length && !pending ? { ...d, status: "processed" } : d;
    }),
  }));
}

// ---- Prescriptions & medicines ---------------------------------------------

export function savePrescription(p: Prescription) {
  update((s) => ({ ...s, prescriptions: s.prescriptions.some((x) => x.id === p.id) ? s.prescriptions.map((x) => (x.id === p.id ? p : x)) : [...s.prescriptions, p] }), {
    action: "prescription.saved",
    detail: `Prescription saved (${p.status})`,
  });
  if (p.documentId && p.status === "verified") updateDocument(p.documentId, { status: "processed" });
}

export function addMedicine(m: Omit<Medicine, "id" | "createdAt">) {
  update((s) => ({ ...s, medicines: [...s.medicines, { ...m, id: uid("m"), createdAt: now() }] }), { action: "medicine.added", detail: "Medicine schedule created after user confirmation" });
}

export function setMedicineStatus(id: string, status: Medicine["status"]) {
  update((s) => ({ ...s, medicines: s.medicines.map((m) => (m.id === id ? { ...m, status } : m)) }), { action: "medicine.status", detail: `Medicine marked ${status} by user` });
}

export function deleteMedicine(id: string) {
  update((s) => ({ ...s, medicines: s.medicines.filter((m) => m.id !== id) }), { action: "medicine.deleted", detail: "Medicine removed by user (dose history kept)" });
}

// ---- Appointments ---------------------------------------------------------

export function saveAppointment(a: Appointment) {
  update((s) => ({ ...s, appointments: s.appointments.some((x) => x.id === a.id) ? s.appointments.map((x) => (x.id === a.id ? a : x)) : [...s.appointments, a] }), {
    action: "appointment.saved",
    detail: "Appointment saved",
  });
}
export function deleteAppointment(id: string) {
  update((s) => ({ ...s, appointments: s.appointments.filter((a) => a.id !== id) }), { action: "appointment.deleted", detail: "Appointment deleted" });
}

// ---- Profiles, health profile, access ---------------------------------------

export function saveProfile(p: Profile) {
  update((s) => ({ ...s, profiles: s.profiles.some((x) => x.id === p.id) ? s.profiles.map((x) => (x.id === p.id ? p : x)) : [...s.profiles, p] }), { action: "profile.saved", detail: "Profile details saved" });
}

export function deleteProfile(id: string) {
  // Originals go too: storage objects aren't removed by the database cascade.
  for (const d of getState()?.documents ?? []) if (d.profileId === id && d.fileKey) void deleteFile(d.fileKey).catch(() => undefined);
  update(
    (s) => {
      const keep = <T extends { profileId: string }>(xs: T[]) => xs.filter((x) => x.profileId !== id);
      const profiles = s.profiles.filter((p) => p.id !== id);
      return {
        ...s,
        profiles,
        activeProfileId: profiles[0]?.id ?? s.activeProfileId,
        grants: keep(s.grants),
        documents: keep(s.documents),
        observations: keep(s.observations),
        prescriptions: keep(s.prescriptions),
        medicines: keep(s.medicines),
        doseLogs: keep(s.doseLogs),
        appointments: keep(s.appointments),
        healthEntries: keep(s.healthEntries),
        shareLinks: keep(s.shareLinks),
      };
    },
    { action: "profile.deleted", detail: "Profile and its records deleted" },
  );
}

export function addHealthEntry(e: Omit<HealthEntry, "id" | "recordedAt">) {
  update((s) => ({ ...s, healthEntries: [...s.healthEntries, { ...e, id: uid("h"), recordedAt: now() }] }), { action: "health.added", detail: `Health profile ${e.kind} added` });
}
export function removeHealthEntry(id: string) {
  update((s) => ({ ...s, healthEntries: s.healthEntries.filter((h) => h.id !== id) }), { action: "health.removed", detail: "Health profile entry removed" });
}
export function verifyHealthEntry(id: string) {
  update((s) => ({ ...s, healthEntries: s.healthEntries.map((h) => (h.id === id ? { ...h, source: "verified" } : h)) }), { action: "health.verified", detail: "Health profile entry confirmed by user" });
}

export function grantAccess(profileId: string, email: string, role: "viewer" | "editor") {
  update((s) => ({ ...s, grants: [...s.grants, { id: uid("g"), profileId, granteeEmail: email, role, status: "pending", createdAt: now() }] }), {
    action: "access.granted",
    detail: `Invitation created (${role})`,
  });
}
export function revokeGrant(id: string) {
  update((s) => ({ ...s, grants: s.grants.map((g) => (g.id === id ? { ...g, status: "revoked", revokedAt: now() } : g)) }), { action: "access.revoked", detail: "Access revoked" });
}

// ---- Sharing --------------------------------------------------------------

export function createShareLink(input: Omit<ShareLink, "id" | "token" | "createdAt">): ShareLink {
  const link: ShareLink = { ...input, id: uid("sl"), token: secureToken(), createdAt: now() };
  update((s) => ({ ...s, shareLinks: [link, ...s.shareLinks] }), { action: "share.created", detail: `Share link created (${input.documentIds.length} documents)` });
  return link;
}
export function revokeShareLink(id: string) {
  update((s) => ({ ...s, shareLinks: s.shareLinks.map((l) => (l.id === id ? { ...l, revokedAt: now() } : l)) }), { action: "share.revoked", detail: "Share link revoked" });
}
