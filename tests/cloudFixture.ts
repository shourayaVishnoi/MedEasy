import type { AppState } from "@/lib/types";
import { TABLES, type Rows } from "@/lib/cloud/tables";
import { uid } from "@/lib/util";
import { demo } from "./helpers";

export const USER = "00000000-0000-4000-8000-0000000000a1";
export const OTHER = "00000000-0000-4000-8000-0000000000b2";
export const SHARE_TOKEN = "Zq3v9Y0hX2nU5pL8rT1wK4mC7aE6sD0fG9jH2bN5xQ8";

/** The demo workspace as a signed-in account would hold it: UUID ids, files in storage, a share link. */
export function cloudState(): AppState {
  const s = demo();
  const ids = new Map<string, string>();
  const collect = (v: unknown, key?: string) => {
    if (Array.isArray(v)) v.forEach((x) => collect(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) collect(x, k);
    else if (typeof v === "string" && key && /^(id|profileId|documentId|medicineId|prescriptionId|activeProfileId|sourceDocumentId)$/.test(key) && !ids.has(v)) ids.set(v, uid());
  };
  collect(s);
  const remap = (v: unknown, key?: string): unknown => {
    if (Array.isArray(v)) return v.map((x) => (typeof x === "string" && ids.has(x) ? ids.get(x) : remap(x, key)));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remap(x, k)]));
    if (typeof v === "string" && ids.has(v)) return ids.get(v);
    if (typeof v === "string" && key === "occurrenceKey") {
      const [m, ...rest] = v.split("|");
      return [ids.get(m) ?? m, ...rest].join("|");
    }
    return v;
  };
  const c = remap(s) as AppState;
  c.mode = "cloud";
  c.userId = USER;
  c.settings = { ...c.settings, onboardedAt: "2026-10-01T08:00:00.000Z", reminderEmail: "a@example.com", quietHours: { start: "22:30", end: "07:00" } };
  c.profiles = c.profiles.map((p) => ({ ...p, ownerId: USER }));
  c.grants = c.grants.map((g) => ({ ...g, granteeEmail: g.status === "active" ? "b@example.com" : g.granteeEmail, status: g.status === "active" ? "pending" : g.status }));
  c.documents = c.documents.map((d) => ({ ...d, fileKey: `${d.profileId}/${d.id}/1/${d.fileName}`, sha256: "ab".repeat(32), sizeBytes: Math.max(1, d.sizeBytes) }));
  // An observation with a correction, so revision history is exercised.
  const o = c.observations[0];
  c.observations[0] = { ...o, valueText: "2.2", value: 2.2, verification: "corrected", history: [...o.history, { value: "2.2 mIU/L", at: new Date(Date.parse(o.history.at(-1)?.at ?? "2026-10-01T00:00:00Z") + 60000).toISOString(), by: "user" }] };
  c.appointments = c.appointments.map((a, i) => (i === 0 ? { ...a, followUpTasks: ["Book blood test", "Bring old reports"] } : a));
  const alex = c.activeProfileId;
  c.shareLinks = [
    { id: uid(), profileId: alex, token: SHARE_TOKEN, label: "For Dr. Sample", documentIds: c.documents.filter((d) => d.profileId === alex).slice(0, 2).map((d) => d.id), includeMedications: true, includeAppointments: false, expiresAt: "2099-01-01T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z" },
  ];
  return c;
}

/** Same rows regardless of the order they were produced or returned in. */
export function sorted(r: Rows): Rows {
  return Object.fromEntries(TABLES.map((t) => [t.name, [...(r[t.name] ?? [])].sort((a, b) => JSON.stringify(t.pk.map((k) => a[k])).localeCompare(JSON.stringify(t.pk.map((k) => b[k]))))]));
}
