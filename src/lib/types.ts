// Core domain types shared by the demo store, the Supabase data layer and domain logic.
// Every record belongs to exactly one personal profile (profileId).

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO timestamp

export type Relationship = "self" | "child" | "parent" | "partner" | "other";

export interface Profile {
  id: ID;
  displayName: string;
  preferredName?: string;
  relationship: Relationship;
  dateOfBirth?: ISODate;
  emergencyContact?: string;
  preferredProvider?: string;
  notes?: string;
  createdAt: ISODateTime;
  /** Account that owns the profile (live accounts only). Shared profiles have another owner. */
  ownerId?: ID;
}

export type AccessRole = "viewer" | "editor";
export type AccessStatus = "pending" | "active" | "revoked";

export interface AccessGrant {
  id: ID;
  profileId: ID;
  granteeEmail: string;
  role: AccessRole;
  status: AccessStatus;
  createdAt: ISODateTime;
  revokedAt?: ISODateTime;
}

export const DOCUMENT_CATEGORIES = [
  "lab_report",
  "prescription",
  "consultation",
  "discharge",
  "imaging",
  "vaccination",
  "allergy",
  "history",
  "bill",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type ProcessingStatus = "uploaded" | "processing" | "needs_review" | "processed" | "failed";

export interface MedicalDocument {
  id: ID;
  profileId: ID;
  title: string;
  category: DocumentCategory;
  customCategory?: string;
  documentDate?: ISODate;
  provider?: string;
  tags: string[];
  notes?: string;
  uploadedAt: ISODateTime;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Key of the untouched original file in object storage (IndexedDB in demo mode). */
  fileKey?: string;
  /** SHA-256 of the original file, hex. */
  sha256?: string;
  /** Extracted text, one entry per page. */
  pages?: string[];
  status: ProcessingStatus;
  /** Safe-for-display explanation of a processing failure. */
  errorMessage?: string;
  isDemo?: boolean;
  uploadedBy?: ID;
}

export type Verification = "extracted" | "confirmed" | "corrected" | "manual";

export interface FieldRevision {
  value: string;
  at: ISODateTime;
  by: "extraction" | "user";
}

export interface LabObservation {
  id: ID;
  profileId: ID;
  documentId: ID;
  testName: string;
  /** Normalised key used to decide comparability (never merges different tests). */
  testKey: string;
  valueText: string;
  value: number | null;
  unit?: string;
  refText?: string;
  refLow?: number;
  refHigh?: number;
  flag?: "H" | "L" | null;
  observedOn?: ISODate;
  page?: number;
  sourceLine?: string;
  confidence: number;
  reviewReasons: string[];
  verification: Verification;
  history: FieldRevision[];
}

export interface PrescriptionItem {
  id: ID;
  medicineName: string;
  brandName?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  dose?: string;
  route?: string;
  frequencyText?: string;
  times?: string[];
  foodInstruction?: string;
  durationText?: string;
  instructions?: string;
  sourceLine?: string;
  confidence: number;
  reviewReasons: string[];
  verified: boolean;
}

export interface Prescription {
  id: ID;
  profileId: ID;
  documentId?: ID;
  prescriber?: string;
  prescribedOn?: ISODate;
  notes?: string;
  items: PrescriptionItem[];
  status: "draft" | "verified";
  createdAt: ISODateTime;
}

export type MedicineStatus = "active" | "paused" | "completed";

export interface MedicationSchedule {
  /** Local wall-clock times, HH:MM, 24h. */
  times: string[];
  /** Weekdays 0 (Sun) – 6 (Sat). Empty = every day. */
  weekdays: number[];
  startDate: ISODate;
  endDate?: ISODate;
  timezone: string;
  /** One-time reminders set this flag; only startDate is used. */
  oneTime?: boolean;
}

export interface Medicine {
  id: ID;
  profileId: ID;
  prescriptionId?: ID;
  name: string;
  strength?: string;
  dose: string;
  route?: string;
  frequencyText?: string;
  instructions?: string;
  prescriber?: string;
  status: MedicineStatus;
  schedule: MedicationSchedule;
  createdAt: ISODateTime;
}

export type DoseStatus = "taken" | "skipped" | "unconfirmed";

export interface DoseLog {
  id: ID;
  profileId: ID;
  medicineId: ID;
  /** `${medicineId}|${date}|${time}` – unique per occurrence (idempotency key). */
  occurrenceKey: string;
  scheduledFor: ISODateTime;
  status: DoseStatus;
  takenAt?: ISODateTime;
  note?: string;
  snoozedUntil?: ISODateTime;
  recordedAt: ISODateTime;
}

export type AppointmentType =
  | "doctor"
  | "lab_test"
  | "follow_up"
  | "vaccination"
  | "prescription_review"
  | "other";

export interface Appointment {
  id: ID;
  profileId: ID;
  type: AppointmentType;
  title: string;
  startsAt: ISODateTime;
  provider?: string;
  location?: string;
  purpose?: string;
  questions: string[];
  preparation?: string;
  followUpTasks: string[];
  relatedDocumentIds: ID[];
  status: "upcoming" | "completed" | "cancelled";
}

export type HealthEntryKind = "allergy" | "condition" | "surgery" | "history" | "note";
export type EntrySource = "user" | "document" | "verified";

export interface HealthEntry {
  id: ID;
  profileId: ID;
  kind: HealthEntryKind;
  text: string;
  source: EntrySource;
  sourceDocumentId?: ID;
  recordedAt: ISODateTime;
}

export interface ShareLink {
  id: ID;
  profileId: ID;
  /** 256-bit random token; stored hashed in production. */
  token: string;
  /** SHA-256 of the token, hex. Live accounts only keep this; the token itself is shown once. */
  tokenHash?: string;
  label: string;
  documentIds: ID[];
  includeMedications: boolean;
  includeAppointments: boolean;
  expiresAt: ISODateTime;
  revokedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface AuditEvent {
  id: ID;
  at: ISODateTime;
  action: string;
  detail: string;
}

export interface ChatMessage {
  id: ID;
  role: "user" | "assistant";
  text: string;
  citations?: { documentId: ID; label: string }[];
  at: ISODateTime;
}

export interface Settings {
  name: string;
  language: string;
  locale: string;
  timezone: string;
  quietHours: { start: string; end: string } | null;
  snoozeMinutes: number;
  channels: { browser: boolean; email: boolean; sms: boolean };
  aiEnabled: boolean;
  keepAssistantHistory: boolean;
  onboarded: boolean;
  onboardedAt?: ISODateTime;
  /** Where email/SMS reminders go (live accounts). */
  reminderEmail?: string;
  reminderPhone?: string;
}

export interface AppState {
  version: 1;
  /** "demo": browser-only workspace. "cloud": a signed-in account backed by Supabase. */
  mode: "demo" | "cloud";
  /** Signed-in account id (cloud mode). */
  userId?: ID;
  activeProfileId: ID;
  settings: Settings;
  profiles: Profile[];
  grants: AccessGrant[];
  documents: MedicalDocument[];
  observations: LabObservation[];
  prescriptions: Prescription[];
  medicines: Medicine[];
  doseLogs: DoseLog[];
  appointments: Appointment[];
  healthEntries: HealthEntry[];
  shareLinks: ShareLink[];
  audit: AuditEvent[];
  chat: ChatMessage[];
}
