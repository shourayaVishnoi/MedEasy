/**
 * Runs the sync layer's writes against a real Postgres with the migrations and
 * row-level security applied. Started by scripts/test-db.sh (skipped otherwise).
 * Inserts mimic Supabase's REST upsert: only the columns sent are written, the
 * rest take their defaults.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { TABLES, diffRows, fromRows, toRows, type Row, type Rows, type SyncPlan } from "@/lib/cloud/tables";
import { OTHER, SHARE_TOKEN, USER, cloudState, sorted } from "./cloudFixture";

const HOST = process.env.HEALTHOS_PG_HOST;
const PORT = process.env.HEALTHOS_PG_PORT ?? "54329";

function psql(sql: string, as?: string | "anon"): string {
  const prelude =
    as === "anon"
      ? `set "request.jwt.claim.sub" = ''; set role anon;`
      : as
        ? `set "request.jwt.claim.sub" = '${as}'; set role authenticated;`
        : "";
  return execFileSync("psql", ["-h", HOST!, "-p", PORT, "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qtAX"], {
    input: `${prelude}\n${sql}`,
    encoding: "utf8",
  }).trim();
}

const lit = (v: unknown) => `$j$${JSON.stringify(v)}$j$`;

function upsertSql(table: string, pk: string[], rows: Row[], appendOnly = false) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const list = cols.map((c) => `"${c}"`).join(", ");
  const conflict = appendOnly
    ? `on conflict (${pk.join(", ")}) do nothing`
    : `on conflict (${pk.join(", ")}) do update set ${cols.filter((c) => !pk.includes(c)).map((c) => `"${c}" = excluded."${c}"`).join(", ") || `${pk[0]} = excluded.${pk[0]}`}`;
  return `insert into public.${table} (${list}) select ${list} from json_populate_recordset(null::public.${table}, ${lit(rows)}) ${conflict};`;
}

function applyPlan(plan: SyncPlan, as: string) {
  const sql: string[] = [];
  for (const { table, rows } of plan.upserts) sql.push(upsertSql(table.name, table.pk, rows, table.appendOnly));
  for (const { table, keys } of plan.deletes)
    for (const k of keys) sql.push(`delete from public.${table.name} where ${table.pk.map((c) => `${c}::text = ${lit(String(k[c])).replace(/^\$j\$"|"\$j\$$/g, "'")}`).join(" and ")};`);
  psql(sql.join("\n"), as);
}

function readAll(as: string): Rows {
  const out: Rows = {};
  for (const t of TABLES) out[t.name] = JSON.parse(psql(`select coalesce(json_agg(t), '[]') from public.${t.name} t;`, as) || "[]");
  return out;
}

describe.skipIf(!HOST)("cloud sync against Postgres with RLS", () => {
  const s = cloudState();
  let deletedDocId = "";

  it("saves a full workspace and reads it back unchanged", () => {
    psql(`insert into auth.users values ('${USER}', 'a@example.com'), ('${OTHER}', 'b@example.com') on conflict do nothing;`);
    const empty: Rows = Object.fromEntries(TABLES.map((t) => [t.name, []]));
    applyPlan(diffRows(empty, toRows(s, USER)), USER);
    const back = fromRows(readAll(USER), USER, s.activeProfileId);
    expect(sorted(toRows(back, USER))).toEqual(sorted(toRows(s, USER)));
  });

  it("applies edits and deletions as a minimal diff", () => {
    const before = toRows(s, USER);
    const doc = s.documents.find((d) => d.category === "lab_report")!;
    deletedDocId = doc.id;
    const next = {
      ...s,
      documents: s.documents.filter((d) => d.id !== doc.id),
      observations: s.observations.filter((o) => o.documentId !== doc.id),
      medicines: s.medicines.map((m, i) => (i === 0 ? { ...m, status: "paused" as const, schedule: { ...m.schedule, times: ["09:30"] } } : m)),
      shareLinks: s.shareLinks.map((l) => ({ ...l, revokedAt: undefined })),
    };
    applyPlan(diffRows(before, toRows(next, USER)), USER);
    const back = fromRows(readAll(USER), USER, s.activeProfileId);
    expect(back.documents.map((d) => d.id)).not.toContain(doc.id);
    expect(back.observations.some((o) => o.documentId === doc.id)).toBe(false);
    const med = back.medicines.find((m) => m.id === s.medicines[0].id)!;
    expect(med.status).toBe("paused");
    expect(med.schedule.times).toEqual(["09:30"]);
    expect(sorted(toRows(back, USER))).toEqual(sorted(toRows(next, USER)));
  });

  it("keeps another account out", () => {
    const seen = readAll(OTHER);
    expect(seen.health_profiles).toEqual([]);
    expect(seen.documents).toEqual([]);
    expect(seen.lab_observations).toEqual([]);
    expect(() => psql(upsertSql("documents", ["id"], [{ id: s.documents[1].id, profile_id: s.profiles[0].id, title: "x", category: "other", uploaded_by: OTHER }]), OTHER)).toThrow(/row-level security/);
  });

  it("links an emailed invitation when the invited person signs in", () => {
    expect(psql("select public.accept_pending_grants();", OTHER)).toBe("1");
    const seen = readAll(OTHER);
    const shared = s.grants.find((g) => g.granteeEmail === "b@example.com")!;
    expect(seen.health_profiles.map((p) => p.id)).toEqual([shared.profileId]);
    // Viewer access: reading works, writing doesn't.
    expect(seen.documents.length).toBeGreaterThan(0);
    expect(() => psql(`update public.documents set title = 'changed' where profile_id = '${shared.profileId}' returning id;`, OTHER)).not.toThrow();
    expect(JSON.parse(psql(`select json_agg(title) from public.documents where profile_id = '${shared.profileId}';`, USER))).not.toContain("changed");
  });

  it("opens a share link only with the right token", () => {
    const packet = JSON.parse(psql(`select public.shared_packet('${SHARE_TOKEN}');`, "anon"));
    const expected = s.shareLinks[0].documentIds.filter((id) => id !== deletedDocId);
    expect(packet.documents.map((d: Row) => d.id).sort()).toEqual(expected.sort());
    expect(packet.medicines.length).toBeGreaterThan(0);
    expect(packet.appointments).toEqual([]);
    expect(JSON.stringify(packet)).not.toContain("uploaded_by");
    const state = fromRows(packet, "", packet.link.profile_id);
    expect(state.profiles[0].displayName).toBe(s.profiles[0].displayName);
    expect(psql(`select public.shared_packet('${SHARE_TOKEN.slice(0, -1)}x') is null;`, "anon")).toBe("t");
    psql(`update public.share_links set revoked_at = now();`, USER);
    expect(psql(`select public.shared_packet('${SHARE_TOKEN}') is null;`, "anon")).toBe("t");
  });

  it("lets the app append its audit trail but not rewrite it", () => {
    const before = Number(psql("select count(*) from public.audit_logs;", USER));
    expect(before).toBeGreaterThan(0);
    psql(`delete from public.audit_logs;`, USER);
    expect(Number(psql("select count(*) from public.audit_logs;", USER))).toBe(before);
  });

  it("rate-limits across server instances through the database", () => {
    const hits = [1, 2, 3].map(() => Number(psql("select public.rate_limit_hit('test:1.2.3.4', 2, 60);")));
    expect(hits.slice(0, 2)).toEqual([0, 0]);
    expect(hits[2]).toBeGreaterThan(0);
    expect(() => psql("select public.rate_limit_hit('x', 1, 1);", USER)).toThrow(/permission denied/);
  });
});
