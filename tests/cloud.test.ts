import { describe, expect, it } from "vitest";
import { TABLES, diffRows, fromRows, toRows } from "@/lib/cloud/tables";
import { sha256Hex } from "@/lib/sha256";
import { isUuid, stableUuid } from "@/lib/util";
import { OTHER, USER, cloudState, sorted } from "./cloudFixture";

describe("cloud mapping", () => {
  it("round-trips the workspace through table rows", () => {
    const s = cloudState();
    const rows = toRows(s, USER);
    const back = fromRows(rows, USER, s.activeProfileId);
    expect(sorted(toRows(back, USER))).toEqual(sorted(rows));
    const byId = <T extends { id: string }>(xs: T[], id: string) => xs.find((x) => x.id === id)!;
    for (const d of s.documents) expect(byId(back.documents, d.id).pages).toEqual(d.pages);
    expect(byId(back.observations, s.observations[0].id).history).toEqual(s.observations[0].history);
    for (const p of s.prescriptions) expect(byId(back.prescriptions, p.id).items.map((i) => i.medicineName)).toEqual(p.items.map((i) => i.medicineName));
    expect(byId(back.appointments, s.appointments[0].id).followUpTasks).toEqual(["Book blood test", "Bring old reports"]);
    expect(back.settings.quietHours).toEqual({ start: "22:30", end: "07:00" });
    expect(back.shareLinks[0].token).toBe("");
    expect(back.shareLinks[0].tokenHash).toBe(sha256Hex(s.shareLinks[0].token));
  });

  it("uses UUIDs for every record id", () => {
    const rows = toRows(cloudState(), USER);
    for (const t of TABLES) for (const r of rows[t.name]) for (const k of t.pk) if (k !== "page") expect(isUuid(String(r[k])), `${t.name}.${k}`).toBe(true);
  });

  it("never writes profiles owned by someone else", () => {
    const s = cloudState();
    s.profiles[1] = { ...s.profiles[1], ownerId: OTHER };
    const rows = toRows(s, USER);
    expect(rows.health_profiles.map((p) => p.id)).not.toContain(s.profiles[1].id);
    expect(rows.profile_access.every((g) => g.profile_id !== s.profiles[1].id)).toBe(true);
  });

  it("writes only what changed", () => {
    const s = cloudState();
    const before = toRows(s, USER);
    const next = { ...s, observations: s.observations.map((o, i) => (i === 1 ? { ...o, verification: o.verification === "confirmed" ? ("manual" as const) : ("confirmed" as const) } : o)) };
    const plan = diffRows(before, toRows(next, USER));
    expect(plan.deletes).toEqual([]);
    expect(plan.upserts.map((u) => [u.table.name, u.rows.length])).toEqual([["lab_observations", 1]]);
  });

  it("deletes children before parents and never deletes history", () => {
    const s = cloudState();
    const doc = s.documents.find((d) => s.observations.some((o) => o.documentId === d.id && o.history.length))!;
    const next = { ...s, documents: s.documents.filter((d) => d.id !== doc.id), observations: s.observations.filter((o) => o.documentId !== doc.id) };
    const plan = diffRows(toRows(s, USER), toRows(next, USER));
    const order = plan.deletes.map((d) => d.table.name);
    expect(order.indexOf("lab_observations")).toBeLessThan(order.indexOf("documents"));
    expect(order.indexOf("document_pages")).toBeLessThan(order.indexOf("documents"));
    expect(order).not.toContain("observation_revisions");
    expect(order).not.toContain("audit_logs");
  });

  it("stores a share token only as its SHA-256", () => {
    const s = cloudState();
    const row = toRows(s, USER).share_links[0];
    expect(JSON.stringify(row)).not.toContain(s.shareLinks[0].token);
    expect(row.token_hash).toBe(`\\x${sha256Hex(s.shareLinks[0].token)}`);
  });
});

describe("helpers", () => {
  it("sha256 matches known vectors", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("x".repeat(100))).toBe("09ecb6ebc8bcefc733f6f2ec44f791abeed6a99edf0cc31519637898aebd52d8");
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("stableUuid is deterministic and UUID-shaped", () => {
    expect(stableUuid("a|v1")).toBe(stableUuid("a|v1"));
    expect(stableUuid("a|v1")).not.toBe(stableUuid("a|v2"));
    expect(isUuid(stableUuid("x"))).toBe(true);
  });
});
