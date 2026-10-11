/**
 * Mapping between the in-app workspace (AppState) and the Supabase tables in
 * supabase/migrations. Pure functions only: no network, so they are unit tested
 * and also exercised against a real Postgres in scripts/test-db.sh.
 */
import type { AppState, Appointment, DocumentCategory, HealthEntry, LabObservation, MedicalDocument, Medicine, Prescription, Profile, Settings } from "../types";
import { sha256Hex } from "../sha256";
import { stableUuid } from "../util";

export type Row = Record<string, unknown>;

export interface TableDef {
  name: string;
  pk: string[];
  /** Rows are only ever inserted (history, audit): never updated or deleted by the app. */
  appendOnly?: boolean;
}

/** Parent tables first. Upserts run in this order; deletes run in reverse. */
export const TABLES: TableDef[] = [
  { name: "accounts", pk: ["id"] },
  { name: "notification_preferences", pk: ["user_id"] },
  { name: "health_profiles", pk: ["id"] },
  { name: "profile_access", pk: ["id"] },
  { name: "documents", pk: ["id"] },
  { name: "document_versions", pk: ["id"] },
  { name: "document_pages", pk: ["document_id", "page"] },
  { name: "lab_observations", pk: ["id"] },
  { name: "reference_intervals", pk: ["observation_id"] },
  { name: "observation_revisions", pk: ["id"], appendOnly: true },
  { name: "prescriptions", pk: ["id"] },
  { name: "prescription_items", pk: ["id"] },
  { name: "medicines", pk: ["id"] },
  { name: "medication_schedules", pk: ["medicine_id"] },
  { name: "dose_logs", pk: ["id"] },
  { name: "appointments", pk: ["id"] },
  { name: "follow_up_reminders", pk: ["id"] },
  { name: "allergies", pk: ["id"] },
  { name: "medical_history_entries", pk: ["id"] },
  { name: "share_links", pk: ["id"] },
  { name: "audit_logs", pk: ["client_id"], appendOnly: true },
];

export type Rows = Record<string, Row[]>;

const opt = <T,>(v: T | undefined | null | ""): T | null => (v === undefined || v === "" ? null : (v as T));
const und = <T,>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);
const iso = (v: unknown): string => (typeof v === "string" && v ? new Date(v).toISOString() : "");
const isoOpt = (v: unknown): string | undefined => (typeof v === "string" && v ? new Date(v).toISOString() : undefined);
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const hhmm = (v: unknown) => (typeof v === "string" ? v.slice(0, 5) : null);

function pageMethod(mime: string) {
  if (mime === "application/pdf") return "pdf-text";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.startsWith("image/")) return "ocr";
  return "text";
}

// ------------------------------------------------------------------ to rows

/** All rows this account may write, derived from the workspace. */
export function toRows(s: AppState, userId: string): Rows {
  const owned = new Set(s.profiles.filter((p) => !p.ownerId || p.ownerId === userId).map((p) => p.id));
  const r: Rows = Object.fromEntries(TABLES.map((t) => [t.name, [] as Row[]]));
  const st = s.settings;

  r.accounts.push({
    id: userId,
    display_name: opt(st.name),
    language: st.language,
    locale: st.locale,
    timezone: st.timezone,
    onboarded_at: st.onboarded ? (st.onboardedAt ?? "2000-01-01T00:00:00.000Z") : null,
    ai_enabled: st.aiEnabled,
    keep_assistant_history: st.keepAssistantHistory,
  });
  r.notification_preferences.push({
    user_id: userId,
    channels: (["browser", "email", "sms"] as const).filter((c) => st.channels[c]),
    quiet_start: st.quietHours?.start ?? null,
    quiet_end: st.quietHours?.end ?? null,
    snooze_minutes: st.snoozeMinutes,
    timezone: st.timezone,
    email: opt(st.reminderEmail),
    phone_e164: opt(st.reminderPhone),
  });

  for (const p of s.profiles) {
    if (!owned.has(p.id)) continue;
    r.health_profiles.push({
      id: p.id, owner_id: userId, display_name: p.displayName, preferred_name: opt(p.preferredName), relationship: p.relationship,
      date_of_birth: opt(p.dateOfBirth), emergency_contact: opt(p.emergencyContact), preferred_provider: opt(p.preferredProvider), notes: opt(p.notes), created_at: p.createdAt,
    });
  }
  for (const g of s.grants) {
    if (!owned.has(g.profileId)) continue;
    r.profile_access.push({ id: g.id, profile_id: g.profileId, grantee_email: g.granteeEmail.toLowerCase(), role: g.role, status: g.status, invited_by: userId, created_at: g.createdAt, revoked_at: opt(g.revokedAt) });
  }
  for (const d of s.documents) {
    r.documents.push({
      id: d.id, profile_id: d.profileId, title: d.title, category: d.category, custom_category: opt(d.customCategory), document_date: opt(d.documentDate),
      provider: opt(d.provider), tags: d.tags, notes: opt(d.notes), status: d.status, error_message: opt(d.errorMessage), uploaded_by: d.uploadedBy ?? userId, uploaded_at: d.uploadedAt,
    });
    if (d.fileKey)
      r.document_versions.push({ id: stableUuid(`${d.id}|v1`), document_id: d.id, version: 1, storage_path: d.fileKey, file_name: d.fileName, mime_type: d.mimeType, size_bytes: Math.max(1, d.sizeBytes), sha256: opt(d.sha256) });
    (d.pages ?? []).forEach((text, i) => r.document_pages.push({ document_id: d.id, page: i + 1, text, method: pageMethod(d.mimeType) }));
  }
  for (const o of s.observations) {
    r.lab_observations.push({
      id: o.id, profile_id: o.profileId, document_id: o.documentId, test_name: o.testName, test_key: o.testKey, value_text: o.valueText, value: o.value, unit: opt(o.unit),
      observed_on: opt(o.observedOn), flag: o.flag ?? null, page: o.page ?? null, source_line: opt(o.sourceLine), confidence: Math.round(o.confidence * 100) / 100, review_reasons: o.reviewReasons, verification: o.verification,
    });
    if (o.refText || o.refLow !== undefined || o.refHigh !== undefined) r.reference_intervals.push({ observation_id: o.id, text: o.refText ?? "", low: o.refLow ?? null, high: o.refHigh ?? null });
    o.history.forEach((h, i) =>
      r.observation_revisions.push({ id: stableUuid(`${o.id}|rev|${i}`), observation_id: o.id, value_text: h.value, unit: null, ref_text: null, source: h.by, revised_by: h.by === "user" ? userId : null, created_at: h.at }),
    );
  }
  for (const p of s.prescriptions) {
    r.prescriptions.push({ id: p.id, profile_id: p.profileId, document_id: opt(p.documentId), prescriber: opt(p.prescriber), prescribed_on: opt(p.prescribedOn), notes: opt(p.notes), status: p.status, created_at: p.createdAt });
    p.items.forEach((it, i) =>
      r.prescription_items.push({
        id: it.id, prescription_id: p.id, position: i, medicine_name: it.medicineName, brand_name: opt(it.brandName), active_ingredient: opt(it.activeIngredient), strength: opt(it.strength),
        dosage_form: opt(it.dosageForm), dose: opt(it.dose), route: opt(it.route), frequency_text: opt(it.frequencyText), times: it.times?.length ? it.times : null, food_instruction: opt(it.foodInstruction),
        duration_text: opt(it.durationText), instructions: opt(it.instructions), source_line: opt(it.sourceLine), confidence: Math.round(it.confidence * 100) / 100, review_reasons: it.reviewReasons, verified: it.verified,
      }),
    );
  }
  for (const m of s.medicines) {
    r.medicines.push({
      id: m.id, profile_id: m.profileId, prescription_id: opt(m.prescriptionId), name: m.name, strength: opt(m.strength), dose: m.dose, route: opt(m.route),
      frequency_text: opt(m.frequencyText), instructions: opt(m.instructions), prescriber: opt(m.prescriber), status: m.status, created_at: m.createdAt,
    });
    const sc = m.schedule;
    r.medication_schedules.push({ medicine_id: m.id, times: sc.times, weekdays: sc.weekdays, start_date: sc.startDate, end_date: opt(sc.endDate), timezone: sc.timezone, one_time: !!sc.oneTime });
  }
  for (const l of s.doseLogs) {
    r.dose_logs.push({
      id: l.id, occurrence_key: l.occurrenceKey, profile_id: l.profileId, medicine_id: l.medicineId, scheduled_for: l.scheduledFor, status: l.status,
      taken_at: opt(l.takenAt), note: opt(l.note), snoozed_until: opt(l.snoozedUntil), recorded_by: userId, recorded_at: l.recordedAt,
    });
  }
  for (const a of s.appointments) {
    r.appointments.push({
      id: a.id, profile_id: a.profileId, type: a.type, title: a.title, starts_at: a.startsAt, provider: opt(a.provider), location: opt(a.location), purpose: opt(a.purpose),
      preparation: opt(a.preparation), questions: a.questions, related_document_ids: a.relatedDocumentIds, status: a.status,
    });
    a.followUpTasks.forEach((task, i) => r.follow_up_reminders.push({ id: stableUuid(`${a.id}|task|${i}`), profile_id: a.profileId, appointment_id: a.id, position: i, task }));
  }
  for (const h of s.healthEntries) {
    if (h.kind === "allergy")
      r.allergies.push({ id: h.id, profile_id: h.profileId, substance: h.text, reaction: null, source: h.source, source_document_id: opt(h.sourceDocumentId), recorded_at: h.recordedAt });
    else r.medical_history_entries.push({ id: h.id, profile_id: h.profileId, kind: h.kind, text: h.text, source: h.source, source_document_id: opt(h.sourceDocumentId), recorded_at: h.recordedAt });
  }
  for (const l of s.shareLinks) {
    r.share_links.push({
      id: l.id, profile_id: l.profileId, token_hash: `\\x${l.tokenHash ?? sha256Hex(l.token)}`, label: l.label, document_ids: l.documentIds, include_medications: l.includeMedications,
      include_appointments: l.includeAppointments, expires_at: l.expiresAt, revoked_at: opt(l.revokedAt), created_by: userId, created_at: l.createdAt,
    });
  }
  for (const a of s.audit) r.audit_logs.push({ client_id: a.id, actor_id: userId, profile_id: null, action: a.action, detail: a.detail, created_at: a.at });
  return r;
}

// ------------------------------------------------------------------ from rows

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  language: "en",
  locale: "en-GB",
  timezone: "UTC",
  quietHours: null,
  snoozeMinutes: 10,
  channels: { browser: true, email: false, sms: false },
  aiEnabled: false,
  keepAssistantHistory: false,
  onboarded: false,
};

const group = (rows: Row[] | undefined, key: string) => {
  const m = new Map<string, Row[]>();
  for (const row of rows ?? []) {
    const k = String(row[key]);
    m.set(k, [...(m.get(k) ?? []), row]);
  }
  return m;
};
const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Builds a workspace from rows read back from the database (RLS limits them to what this account may see). */
export function fromRows(r: Rows, userId: string, activeProfileId?: string): AppState {
  const acc = r.accounts?.[0];
  const np = r.notification_preferences?.[0];
  const channels = arr<string>(np?.channels);
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    name: str(acc?.display_name) ?? "",
    language: str(acc?.language) ?? "en",
    locale: str(acc?.locale) ?? "en-GB",
    timezone: str(acc?.timezone) ?? str(np?.timezone) ?? "UTC",
    onboarded: !!acc?.onboarded_at,
    onboardedAt: isoOpt(acc?.onboarded_at),
    aiEnabled: !!acc?.ai_enabled,
    keepAssistantHistory: !!acc?.keep_assistant_history,
    ...(np
      ? {
          channels: { browser: channels.includes("browser"), email: channels.includes("email"), sms: channels.includes("sms") },
          quietHours: np.quiet_start && np.quiet_end ? { start: hhmm(np.quiet_start)!, end: hhmm(np.quiet_end)! } : null,
          snoozeMinutes: Number(np.snooze_minutes ?? 10),
          reminderEmail: str(np.email),
          reminderPhone: str(np.phone_e164),
        }
      : {}),
  };

  const profiles: Profile[] = [...(r.health_profiles ?? [])].sort((a, b) => iso(a.created_at).localeCompare(iso(b.created_at))).map((p) => ({
    id: String(p.id), ownerId: str(p.owner_id), displayName: String(p.display_name), preferredName: str(p.preferred_name), relationship: p.relationship as Profile["relationship"],
    dateOfBirth: str(p.date_of_birth), emergencyContact: str(p.emergency_contact), preferredProvider: str(p.preferred_provider), notes: str(p.notes), createdAt: iso(p.created_at),
  }));

  const versions = group(r.document_versions, "document_id");
  const pages = group(r.document_pages, "document_id");
  const documents: MedicalDocument[] = (r.documents ?? []).map((d) => {
    const v = (versions.get(String(d.id)) ?? []).sort((a, b) => Number(b.version) - Number(a.version))[0];
    const pg = (pages.get(String(d.id)) ?? []).sort((a, b) => Number(a.page) - Number(b.page)).map((p) => String(p.text));
    return {
      id: String(d.id), profileId: String(d.profile_id), title: String(d.title), category: d.category as DocumentCategory, customCategory: str(d.custom_category), documentDate: str(d.document_date),
      provider: str(d.provider), tags: arr<string>(d.tags), notes: str(d.notes), uploadedAt: iso(d.uploaded_at), uploadedBy: str(d.uploaded_by),
      fileName: str(v?.file_name) ?? String(d.title), mimeType: str(v?.mime_type) ?? "text/plain", sizeBytes: Number(v?.size_bytes ?? 0), fileKey: str(v?.storage_path), sha256: str(v?.sha256),
      pages: pg.length ? pg : undefined, status: d.status as MedicalDocument["status"], errorMessage: str(d.error_message),
    };
  });

  const intervals = new Map((r.reference_intervals ?? []).map((x) => [String(x.observation_id), x]));
  const revisions = group(r.observation_revisions, "observation_id");
  const observations: LabObservation[] = (r.lab_observations ?? []).map((o) => {
    const ri = intervals.get(String(o.id));
    return {
      id: String(o.id), profileId: String(o.profile_id), documentId: String(o.document_id), testName: String(o.test_name), testKey: String(o.test_key), valueText: String(o.value_text),
      value: num(o.value), unit: str(o.unit), refText: ri ? str(ri.text) || undefined : undefined, refLow: ri ? und(num(ri.low)) : undefined, refHigh: ri ? und(num(ri.high)) : undefined,
      flag: (o.flag as "H" | "L" | null) ?? null, observedOn: str(o.observed_on), page: und(num(o.page)), sourceLine: str(o.source_line), confidence: Number(o.confidence),
      reviewReasons: arr<string>(o.review_reasons), verification: o.verification as LabObservation["verification"],
      history: (revisions.get(String(o.id)) ?? [])
        .sort((a, b) => iso(a.created_at).localeCompare(iso(b.created_at)))
        .map((h) => ({ value: String(h.value_text), at: iso(h.created_at), by: h.source === "user" ? "user" : "extraction" })),
    };
  });

  const items = group(r.prescription_items, "prescription_id");
  const prescriptions: Prescription[] = (r.prescriptions ?? []).map((p) => ({
    id: String(p.id), profileId: String(p.profile_id), documentId: str(p.document_id), prescriber: str(p.prescriber), prescribedOn: str(p.prescribed_on), notes: str(p.notes),
    status: p.status as Prescription["status"], createdAt: iso(p.created_at),
    items: (items.get(String(p.id)) ?? [])
      .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
      .map((it) => ({
        id: String(it.id), medicineName: String(it.medicine_name), brandName: str(it.brand_name), activeIngredient: str(it.active_ingredient), strength: str(it.strength), dosageForm: str(it.dosage_form),
        dose: str(it.dose), route: str(it.route), frequencyText: str(it.frequency_text), times: Array.isArray(it.times) ? (it.times as string[]) : undefined, foodInstruction: str(it.food_instruction),
        durationText: str(it.duration_text), instructions: str(it.instructions), sourceLine: str(it.source_line), confidence: Number(it.confidence), reviewReasons: arr<string>(it.review_reasons),
        verified: !!it.verified,
      })),
  }));

  const schedules = new Map((r.medication_schedules ?? []).map((x) => [String(x.medicine_id), x]));
  const medicines: Medicine[] = (r.medicines ?? []).map((m) => {
    const sc = schedules.get(String(m.id));
    return {
      id: String(m.id), profileId: String(m.profile_id), prescriptionId: str(m.prescription_id), name: String(m.name), strength: str(m.strength), dose: String(m.dose), route: str(m.route),
      frequencyText: str(m.frequency_text), instructions: str(m.instructions), prescriber: str(m.prescriber), status: m.status as Medicine["status"], createdAt: iso(m.created_at),
      schedule: {
        times: arr<string>(sc?.times), weekdays: arr<number>(sc?.weekdays).map(Number), startDate: str(sc?.start_date) ?? "", endDate: str(sc?.end_date), timezone: str(sc?.timezone) ?? settings.timezone,
        ...(sc?.one_time ? { oneTime: true } : {}),
      },
    };
  });

  const tasks = group(r.follow_up_reminders, "appointment_id");
  const appointments: Appointment[] = (r.appointments ?? []).map((a) => ({
    id: String(a.id), profileId: String(a.profile_id), type: a.type as Appointment["type"], title: String(a.title), startsAt: iso(a.starts_at), provider: str(a.provider), location: str(a.location),
    purpose: str(a.purpose), preparation: str(a.preparation), questions: arr<string>(a.questions), relatedDocumentIds: arr<string>(a.related_document_ids), status: a.status as Appointment["status"],
    followUpTasks: (tasks.get(String(a.id)) ?? []).sort((x, y) => Number(x.position ?? 0) - Number(y.position ?? 0)).map((t) => String(t.task)),
  }));

  const healthEntries: HealthEntry[] = [
    ...(r.allergies ?? []).map((h) => ({ id: String(h.id), profileId: String(h.profile_id), kind: "allergy" as const, text: String(h.substance), source: h.source as HealthEntry["source"], sourceDocumentId: str(h.source_document_id), recordedAt: iso(h.recorded_at) })),
    ...(r.medical_history_entries ?? []).map((h) => ({ id: String(h.id), profileId: String(h.profile_id), kind: h.kind as HealthEntry["kind"], text: String(h.text), source: h.source as HealthEntry["source"], sourceDocumentId: str(h.source_document_id), recordedAt: iso(h.recorded_at) })),
  ];

  const owned = profiles.filter((p) => p.ownerId === userId);
  const active = profiles.some((p) => p.id === activeProfileId) ? activeProfileId! : (owned.find((p) => p.relationship === "self") ?? owned[0] ?? profiles[0])?.id ?? "";

  return {
    version: 1,
    mode: "cloud",
    userId,
    activeProfileId: active,
    settings,
    profiles,
    grants: (r.profile_access ?? []).map((g) => ({
      id: String(g.id), profileId: String(g.profile_id), granteeEmail: String(g.grantee_email), role: g.role as "viewer" | "editor", status: g.status as "pending" | "active" | "revoked",
      createdAt: iso(g.created_at), revokedAt: isoOpt(g.revoked_at),
    })),
    documents: documents.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    observations,
    prescriptions: prescriptions.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    medicines: medicines.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    doseLogs: (r.dose_logs ?? []).map((l) => ({
      id: String(l.id), profileId: String(l.profile_id), medicineId: str(l.medicine_id) ?? "", occurrenceKey: String(l.occurrence_key), scheduledFor: iso(l.scheduled_for),
      status: l.status as "taken" | "skipped" | "unconfirmed", takenAt: isoOpt(l.taken_at), note: str(l.note), snoozedUntil: isoOpt(l.snoozed_until), recordedAt: iso(l.recorded_at),
    })),
    appointments: appointments.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    healthEntries: healthEntries.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
    shareLinks: (r.share_links ?? []).map((l) => ({
      id: String(l.id), profileId: String(l.profile_id), token: "", tokenHash: String(l.token_hash ?? "").replace(/^\\x/, ""), label: String(l.label), documentIds: arr<string>(l.document_ids),
      includeMedications: !!l.include_medications, includeAppointments: !!l.include_appointments, expiresAt: iso(l.expires_at), revokedAt: isoOpt(l.revoked_at), createdAt: iso(l.created_at),
    })),
    audit: (r.audit_logs ?? [])
      .map((a) => ({ id: String(a.client_id ?? a.id), at: iso(a.created_at), action: String(a.action), detail: String(a.detail) }))
      .sort((a, b) => b.at.localeCompare(a.at)),
    chat: [],
  };
}

// ------------------------------------------------------------------ diff

export interface SyncPlan {
  upserts: { table: TableDef; rows: Row[] }[];
  deletes: { table: TableDef; keys: Row[] }[];
}

const keyOf = (t: TableDef, row: Row) => t.pk.map((k) => String(row[k])).join("|");

/** Rows to write and delete so the database matches `next`, given it currently matches `prev`. */
export function diffRows(prev: Rows, next: Rows): SyncPlan {
  const plan: SyncPlan = { upserts: [], deletes: [] };
  for (const t of TABLES) {
    const before = new Map((prev[t.name] ?? []).map((row) => [keyOf(t, row), JSON.stringify(row)]));
    const after = new Map((next[t.name] ?? []).map((row) => [keyOf(t, row), row]));
    const changed = [...after].filter(([k, row]) => (t.appendOnly ? !before.has(k) : before.get(k) !== JSON.stringify(row))).map(([, row]) => row);
    if (changed.length) plan.upserts.push({ table: t, rows: changed });
    if (!t.appendOnly) {
      const gone = (prev[t.name] ?? []).filter((row) => !after.has(keyOf(t, row))).map((row) => Object.fromEntries(t.pk.map((k) => [k, row[k]])));
      if (gone.length) plan.deletes.unshift({ table: t, keys: gone });
    }
  }
  return plan;
}
