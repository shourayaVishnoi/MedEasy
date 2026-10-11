import type { AppointmentType, DocumentCategory, ProcessingStatus } from "./types";
import type { Tone } from "@/components/ui";

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  lab_report: "Lab report",
  prescription: "Prescription",
  consultation: "Consultation note",
  discharge: "Discharge summary",
  imaging: "Imaging report",
  vaccination: "Vaccination record",
  allergy: "Allergy record",
  history: "Medical history",
  bill: "Bill or receipt",
  other: "Other",
};

export const STATUS_META: Record<ProcessingStatus, { label: string; tone: Tone }> = {
  uploaded: { label: "Uploaded", tone: "neutral" },
  processing: { label: "Processing", tone: "info" },
  needs_review: { label: "Needs review", tone: "warn" },
  processed: { label: "Ready", tone: "ok" },
  failed: { label: "Extraction failed", tone: "danger" },
};

export const APPOINTMENT_LABEL: Record<AppointmentType, string> = {
  doctor: "Doctor appointment",
  lab_test: "Lab test",
  follow_up: "Follow-up visit",
  vaccination: "Vaccination",
  prescription_review: "Prescription review",
  other: "Other",
};
