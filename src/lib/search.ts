import type { AppState, DocumentCategory, ID } from "./types";

export type ResultType = "document" | "result" | "medicine" | "prescription" | "appointment";

export interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  date?: string;
  snippet?: string;
  href: string;
  profileId: ID;
  category?: DocumentCategory;
  score: number;
}

export interface SearchFilters {
  profileId?: ID | "all";
  types?: ResultType[];
  category?: DocumentCategory | "all";
  from?: string;
  to?: string;
  provider?: string;
}

function tokens(q: string): string[] {
  return q.toLowerCase().normalize("NFKD").split(/\s+/).filter(Boolean);
}

function scoreText(hay: string, terms: string[]): number {
  const h = hay.toLowerCase().normalize("NFKD");
  let s = 0;
  for (const t of terms) {
    if (!h.includes(t)) return 0;
    s += h.startsWith(t) ? 3 : 1;
  }
  return s;
}

function snippetAround(text: string, terms: string[], radius = 70): string | undefined {
  const lower = text.toLowerCase();
  const i = lower.indexOf(terms[0]);
  if (i < 0) return undefined;
  const start = Math.max(0, i - radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, i + radius).replace(/\s+/g, " ").trim()}…`;
}

/** Search only within profiles the caller is allowed to see (`allowedProfileIds`). */
export function searchRecords(state: AppState, query: string, allowedProfileIds: ID[], filters: SearchFilters = {}): SearchResult[] {
  const terms = tokens(query);
  if (!terms.length) return [];
  const allowed = new Set(allowedProfileIds);
  const inProfile = (pid: ID) => allowed.has(pid) && (!filters.profileId || filters.profileId === "all" || filters.profileId === pid);
  const inRange = (d?: string) => (!filters.from || (d ?? "") >= filters.from) && (!filters.to || (d ?? "9999") <= filters.to);
  const want = (t: ResultType) => !filters.types?.length || filters.types.includes(t);
  const out: SearchResult[] = [];

  for (const d of state.documents) {
    if (!inProfile(d.profileId) || !want("document") || !inRange(d.documentDate)) continue;
    if (filters.category && filters.category !== "all" && d.category !== filters.category) continue;
    if (filters.provider && !(d.provider ?? "").toLowerCase().includes(filters.provider.toLowerCase())) continue;
    const meta = [d.title, d.provider, d.category.replace("_", " "), d.customCategory, d.tags.join(" "), d.notes].join(" ");
    const body = (d.pages ?? []).join("\n");
    const s = scoreText(meta, terms) * 2 + scoreText(body, terms);
    if (s > 0)
      out.push({
        id: d.id,
        type: "document",
        title: d.title,
        subtitle: [d.provider, d.category.replace("_", " ")].filter(Boolean).join(" · "),
        date: d.documentDate,
        snippet: snippetAround(body, terms) ?? d.notes,
        href: `/app/documents/${d.id}`,
        profileId: d.profileId,
        category: d.category,
        score: s,
      });
  }
  for (const o of state.observations) {
    if (!inProfile(o.profileId) || !want("result") || !inRange(o.observedOn)) continue;
    const s = scoreText(`${o.testName} ${o.sourceLine ?? ""}`, terms);
    if (s > 0)
      out.push({
        id: o.id,
        type: "result",
        title: `${o.testName}: ${o.valueText}${o.unit ? ` ${o.unit}` : ""}`,
        subtitle: o.refText ? `Reference interval ${o.refText}${o.flag ? ` · flagged ${o.flag}` : ""}` : "No reference interval on report",
        date: o.observedOn,
        href: `/app/documents/${o.documentId}#obs-${o.id}`,
        profileId: o.profileId,
        score: s + 2,
      });
  }
  for (const m of state.medicines) {
    if (!inProfile(m.profileId) || !want("medicine")) continue;
    const s = scoreText(`${m.name} ${m.strength ?? ""} ${m.prescriber ?? ""} ${m.instructions ?? ""}`, terms);
    if (s > 0)
      out.push({ id: m.id, type: "medicine", title: `${m.name}${m.strength ? ` ${m.strength}` : ""}`, subtitle: `${m.dose} · ${m.frequencyText ?? ""} · ${m.status}`, date: m.schedule.startDate, href: `/app/medicines#med-${m.id}`, profileId: m.profileId, score: s + 1 });
  }
  for (const p of state.prescriptions) {
    if (!inProfile(p.profileId) || !want("prescription") || !inRange(p.prescribedOn)) continue;
    const s = scoreText(`${p.prescriber ?? ""} ${p.items.map((i) => `${i.medicineName} ${i.strength ?? ""} ${i.instructions ?? ""}`).join(" ")}`, terms);
    if (s > 0)
      out.push({ id: p.id, type: "prescription", title: `Prescription${p.prescriber ? ` from ${p.prescriber}` : ""}`, subtitle: p.items.map((i) => i.medicineName).join(", "), date: p.prescribedOn, href: p.documentId ? `/app/documents/${p.documentId}` : "/app/medicines", profileId: p.profileId, score: s });
  }
  for (const a of state.appointments) {
    if (!inProfile(a.profileId) || !want("appointment") || !inRange(a.startsAt.slice(0, 10))) continue;
    const s = scoreText(`${a.title} ${a.provider ?? ""} ${a.purpose ?? ""} ${a.location ?? ""}`, terms);
    if (s > 0)
      out.push({ id: a.id, type: "appointment", title: a.title, subtitle: [a.provider, a.location].filter(Boolean).join(" · "), date: a.startsAt.slice(0, 10), href: `/app/appointments#appt-${a.id}`, profileId: a.profileId, score: s });
  }
  return out.sort((a, b) => b.score - a.score || (b.date ?? "").localeCompare(a.date ?? ""));
}
