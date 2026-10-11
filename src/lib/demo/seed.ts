import type { AppState, MedicalDocument, Medicine, Prescription } from "../types";
import { ingestText } from "../ingest";
import { addDays, todayIn, uid, zonedToUtc } from "../util";
import { occurrencesOn } from "../meds/schedule";

/**
 * Synthetic demo data. Every name, laboratory and value here is fictional and
 * labelled as such. Demo data lives only in this browser and is never mixed
 * with real account records.
 */

const LAB = "Example Diagnostics (fictional lab)";
const DOCTOR = "Dr. Maya Sample (fictional)";

const REPORTS: { title: string; date: string; text: string; lab?: string }[] = [
  {
    title: "Thyroid panel",
    date: "2026-01-14",
    text: `SAMPLE REPORT – SYNTHETIC DATA
Patient Name: Alex Sample
Report Date: 14-Jan-2026
Laboratory: ${LAB}
Test            Result   Unit     Reference Interval
TSH             2.1      mIU/L    0.4 - 4.0
Free T4         1.2      ng/dL    0.8 - 1.8`,
  },
  {
    title: "Thyroid panel",
    date: "2026-04-09",
    text: `SAMPLE REPORT – SYNTHETIC DATA
Patient Name: Alex Sample
Report Date: 09-Apr-2026
Laboratory: ${LAB}
Test            Result   Unit     Reference Interval
TSH             3.4      mIU/L    0.4 - 4.0
Free T4         1.1      ng/dL    0.8 - 1.8`,
  },
  {
    title: "TSH (different laboratory)",
    date: "2026-06-20",
    lab: "Northside Test Centre (fictional)",
    text: `SAMPLE REPORT – SYNTHETIC DATA
Patient Name: Alex Sample
Collection Date: 20 Jun 2026
Laboratory: Northside Test Centre (fictional)
TSH   2.9   µIU/mL   0.35 - 5.50`,
  },
  {
    title: "Complete blood count and thyroid panel",
    date: "2026-09-18",
    text: `SAMPLE REPORT – SYNTHETIC DATA
Patient Name: Alex Sample
Report Date: 18-Sep-2026
Laboratory: ${LAB}
Test               Result     Unit      Reference Interval
Hemoglobin         13.1       g/dL      13.0 - 17.0
Total WBC Count    7,800      /µL       4000 - 11000
Platelet Count     2,10,000   /µL       150000 - 410000
TSH                4.6   H    mIU/L     0.4 - 4.0
Free T4            1.O        ng/dL     0.8 - 1.8
25-OH Vitamin D    18.2  L    ng/mL     30 - 100
Ferritin           45`,
  },
];

const RX_TEXT = `SAMPLE PRESCRIPTION – SYNTHETIC DATA
${DOCTOR}
Date: 20 Sep 2026
Patient: Alex Sample
1. Tab. Metformin 500 mg - 1 tablet twice daily after food x 90 days
2. Cap. Vitamin D3 60000 IU 1 capsule once weekly x 8 weeks
3. Tab Atorvastatin 10mg 0-0-1 after dinner for 3 months`;

const OLD_RX_TEXT = `SAMPLE PRESCRIPTION – SYNTHETIC DATA
${DOCTOR}
Date: 02 Jun 2026
Patient: Alex Sample
1. Tab. Levothyroxine 25 mcg 1 tablet once daily on an empty stomach x 6 months`;

export function createDemoState(now = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"): AppState {
  const today = todayIn(timezone, now);
  const createdAt = now.toISOString();
  const alex = { id: "p_demo_alex", displayName: "Alex Sample", preferredName: "Alex", relationship: "self" as const, dateOfBirth: "1988-05-02", emergencyContact: "Sam Sample (fictional) · +1 555 0100", preferredProvider: DOCTOR, createdAt };
  const mira = { id: "p_demo_mira", displayName: "Mira Sample", relationship: "parent" as const, dateOfBirth: "1957-11-23", createdAt };

  const state: AppState = {
    version: 1,
    mode: "demo",
    activeProfileId: alex.id,
    settings: {
      name: "Alex",
      language: "en",
      locale: "en-GB",
      timezone,
      quietHours: { start: "22:30", end: "07:00" },
      snoozeMinutes: 10,
      channels: { browser: true, email: false, sms: false },
      aiEnabled: true,
      keepAssistantHistory: true,
      onboarded: true,
    },
    profiles: [alex, mira],
    grants: [
      { id: uid("g"), profileId: mira.id, granteeEmail: "caregiver.sample@example.com", role: "viewer", status: "active", createdAt },
      { id: uid("g"), profileId: alex.id, granteeEmail: "partner.sample@example.com", role: "viewer", status: "revoked", createdAt, revokedAt: createdAt },
    ],
    documents: [],
    observations: [],
    prescriptions: [],
    medicines: [],
    doseLogs: [],
    appointments: [],
    healthEntries: [
      { id: uid("h"), profileId: alex.id, kind: "allergy", text: "Penicillin – rash (sample entry)", source: "user", recordedAt: createdAt },
      { id: uid("h"), profileId: alex.id, kind: "condition", text: "Seasonal allergic rhinitis (sample entry)", source: "user", recordedAt: createdAt },
      { id: uid("h"), profileId: alex.id, kind: "surgery", text: "Appendectomy, 2009 (sample entry)", source: "user", recordedAt: createdAt },
    ],
    shareLinks: [],
    audit: [{ id: uid("a"), at: createdAt, action: "demo.created", detail: "Demo workspace created with synthetic data" }],
    chat: [],
  };

  const mkDoc = (profileId: string, title: string, category: MedicalDocument["category"], text: string, date?: string, provider?: string): MedicalDocument => ({
    id: uid("doc"),
    profileId,
    title,
    category,
    documentDate: date,
    provider,
    tags: ["sample"],
    uploadedAt: date ? `${date}T10:00:00.000Z` : createdAt,
    fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`,
    mimeType: "text/plain",
    sizeBytes: text.length,
    status: "uploaded",
    isDemo: true,
  });

  for (const r of REPORTS) {
    const res = ingestText(mkDoc(alex.id, r.title, "lab_report", r.text, r.date, r.lab ?? LAB), [r.text]);
    state.documents.push(res.document);
    state.observations.push(...res.observations);
  }
  // Mark the older reports' values as confirmed by the user, to show verification states.
  for (const o of state.observations) if (o.observedOn && o.observedOn < "2026-09-01" && o.reviewReasons.length === 0) o.verification = "confirmed";

  const miraLab = `SAMPLE REPORT – SYNTHETIC DATA
Patient Name: Mira Sample
Report Date: 02-Aug-2026
Laboratory: ${LAB}
HbA1c            6.4   H   %       4.0 - 5.6
Fasting Glucose  112   H   mg/dL   70 - 99
Creatinine       0.9       mg/dL   0.6 - 1.1`;
  const miraRes = ingestText(mkDoc(mira.id, "Diabetes screening panel", "lab_report", miraLab, "2026-08-02", LAB), [miraLab]);
  state.documents.push(miraRes.document);
  state.observations.push(...miraRes.observations);

  // A verified older prescription that already drives an active schedule.
  const oldRx = ingestText(mkDoc(alex.id, "Prescription – thyroid", "prescription", OLD_RX_TEXT, "2026-06-02", DOCTOR), [OLD_RX_TEXT]);
  oldRx.document.status = "processed";
  const verifiedRx: Prescription = { ...oldRx.prescription!, status: "verified", items: oldRx.prescription!.items.map((i) => ({ ...i, verified: true, reviewReasons: [] })) };
  state.documents.push(oldRx.document);
  state.prescriptions.push(verifiedRx);

  // A new prescription awaiting the user's verification.
  const newRx = ingestText(mkDoc(alex.id, "Prescription – follow-up visit", "prescription", RX_TEXT, "2026-09-20", DOCTOR), [RX_TEXT]);
  state.documents.push(newRx.document);
  state.prescriptions.push(newRx.prescription!);

  const vacc = `SAMPLE RECORD – SYNTHETIC DATA\nVaccination record\nInfluenza vaccine (seasonal) – dose given 12 Oct 2025\nAdministered at Example Community Clinic (fictional)`;
  const v = ingestText(mkDoc(alex.id, "Influenza vaccination", "vaccination", vacc, "2025-10-12", "Example Community Clinic (fictional)"), [vacc]);
  state.documents.push(v.document);

  const consult = `SAMPLE NOTE – SYNTHETIC DATA\nConsultation note – ${DOCTOR}\nDate: 20 Sep 2026\nReason for visit: review of recent blood tests.\nPlan: repeat thyroid tests in 6 weeks. Follow-up visit as scheduled.`;
  const c = ingestText(mkDoc(alex.id, "Consultation note – blood test review", "consultation", consult, "2026-09-20", DOCTOR), [consult]);
  state.documents.push(c.document);

  const levo: Medicine = {
    id: "m_demo_levo",
    profileId: alex.id,
    prescriptionId: verifiedRx.id,
    name: "Levothyroxine",
    strength: "25 mcg",
    dose: "1 tablet",
    route: "Oral",
    frequencyText: "Once daily",
    instructions: "On an empty stomach (as written on the prescription)",
    prescriber: DOCTOR,
    status: "active",
    schedule: { times: ["07:00"], weekdays: [], startDate: addDays(today, -40), endDate: addDays(today, 140), timezone },
    createdAt,
  };
  const vitc: Medicine = {
    id: "m_demo_vitc",
    profileId: alex.id,
    name: "Example Supplement (sample)",
    strength: "500 mg",
    dose: "1 tablet",
    route: "Oral",
    frequencyText: "Twice daily (entered by user)",
    instructions: "Entered manually by the user",
    status: "active",
    schedule: { times: ["13:00", "21:00"], weekdays: [], startDate: addDays(today, -10), timezone },
    createdAt,
  };
  const miraMed: Medicine = {
    id: "m_demo_mira",
    profileId: mira.id,
    name: "Sample Medicine B",
    strength: "5 mg",
    dose: "1 tablet",
    route: "Oral",
    frequencyText: "Once daily (entered by caregiver)",
    status: "active",
    schedule: { times: ["09:00"], weekdays: [], startDate: addDays(today, -60), timezone },
    createdAt,
  };
  state.medicines.push(levo, vitc, miraMed);

  // Dose history for the last few days (some taken, one skipped, some never recorded).
  for (let i = 4; i >= 0; i--) {
    const day = addDays(today, -i);
    for (const occ of occurrencesOn([levo, vitc], day)) {
      if (occ.scheduledFor.getTime() > now.getTime()) continue;
      if (i === 2 && occ.time === "21:00") continue; // left unrecorded on purpose
      const skipped = i === 3 && occ.time === "13:00";
      state.doseLogs.push({
        id: uid("dl"),
        profileId: occ.profileId,
        medicineId: occ.medicineId,
        occurrenceKey: occ.key,
        scheduledFor: occ.scheduledFor.toISOString(),
        status: skipped ? "skipped" : "taken",
        takenAt: skipped ? undefined : new Date(occ.scheduledFor.getTime() + 6 * 60000).toISOString(),
        note: skipped ? "Was away from home (sample note)" : undefined,
        recordedAt: new Date(occ.scheduledFor.getTime() + 7 * 60000).toISOString(),
      });
    }
  }

  const at = (days: number, time: string) => zonedToUtc(addDays(today, days), time, timezone).toISOString();
  state.appointments.push(
    {
      id: uid("ap"),
      profileId: alex.id,
      type: "follow_up",
      title: "Follow-up visit with Dr. Maya Sample",
      startsAt: at(5, "10:30"),
      provider: DOCTOR,
      location: "Example Health Clinic, Room 4 (fictional)",
      purpose: "Review recent blood tests and new prescription",
      questions: ["What does my latest TSH result mean for me?", "Should I change anything about how I take my medicines?"],
      preparation: undefined,
      followUpTasks: ["Bring recent lab reports"],
      relatedDocumentIds: [state.documents[3].id],
      status: "upcoming",
    },
    {
      id: uid("ap"),
      profileId: alex.id,
      type: "lab_test",
      title: "Repeat thyroid tests",
      startsAt: at(26, "08:15"),
      provider: LAB,
      location: "Example Diagnostics, Main Street (fictional)",
      purpose: "Repeat thyroid tests as noted in consultation",
      questions: [],
      preparation: "Per consultation note: none recorded. Ask the lab if any preparation is needed.",
      followUpTasks: [],
      relatedDocumentIds: [],
      status: "upcoming",
    },
    {
      id: uid("ap"),
      profileId: alex.id,
      type: "doctor",
      title: "Blood test review",
      startsAt: "2026-09-20T05:00:00.000Z",
      provider: DOCTOR,
      questions: [],
      followUpTasks: [],
      relatedDocumentIds: [],
      status: "completed",
    },
    {
      id: uid("ap"),
      profileId: mira.id,
      type: "prescription_review",
      title: "Prescription review for Mira",
      startsAt: at(9, "16:00"),
      provider: "Example Family Practice (fictional)",
      questions: [],
      followUpTasks: [],
      relatedDocumentIds: [],
      status: "upcoming",
    },
  );
  return state;
}
