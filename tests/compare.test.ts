import { describe, expect, it } from "vitest";
import { buildComparisons, describeChange } from "@/lib/reports/compare";
import { demo } from "./helpers";

describe("report comparison", () => {
  const s = demo();
  const obs = s.observations.filter((o) => o.profileId === "p_demo_alex");
  const { series, incomparable } = buildComparisons(obs);

  it("compares only the same test in the same unit", () => {
    const tsh = series.filter((x) => x.testKey === "tsh");
    expect(tsh.map((x) => x.unit).sort()).toEqual(["mIU/L", "µIU/mL"]);
    expect(tsh.find((x) => x.unit === "mIU/L")!.points.map((p) => p.valueText)).toEqual(["2.1", "3.4", "4.6"]);
  });

  it("lists same-test-different-unit results as not compared", () => {
    expect(incomparable.map((i) => i.testName)).toContain("TSH");
  });

  it("keeps each point linked to its source document", () => {
    for (const x of series) for (const p of x.points) expect(s.documents.some((d) => d.id === p.documentId)).toBe(true);
  });

  it("describes changes neutrally, without judgement", () => {
    const pts = series.find((x) => x.testKey === "tsh" && x.unit === "mIU/L")!.points;
    const text = describeChange(pts[1], pts[2]);
    expect(text).toBe("The recorded value increased by 1.2 mIU/L from the previous test (3.4 → 4.6 mIU/L).");
    expect(text).not.toMatch(/worse|better|improv|concern/i);
  });

  it("never charts values without a unit", () => {
    expect(series.some((x) => x.testKey === "ferritin")).toBe(false);
  });

  it("adds a caveat when a compared value is an unverified extraction", () => {
    const ft4 = series.find((x) => x.testKey.includes("t4"))!;
    const [prev, last] = ft4.points.slice(-2);
    expect(describeChange(prev, last)).toMatch(/unverified extraction/);
    expect(describeChange(prev, { ...last, verification: "confirmed" })).not.toMatch(/unverified/);
  });
});
