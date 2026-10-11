import { describe, expect, it } from "vitest";
import { explainReport } from "@/lib/ai/explain";
import { addLab, demo } from "./helpers";

const flat = (e: ReturnType<typeof explainReport>) => e.sections.flatMap((s) => s.items.map((i) => i.text)).join("\n");

describe("report explainer", () => {
  it("states that a reference interval is missing instead of inventing one", () => {
    const s = demo();
    addLab(s, "p_demo_alex", "Ferritin 45 ng/mL", "d1", "2026-10-01");
    const doc = s.documents.find((d) => d.id === "d1")!;
    const text = flat(explainReport(doc, s.observations, "simple"));
    expect(text).toMatch(/No reference interval is printed/);
    expect(text).not.toMatch(/\b\d+\s*-\s*\d+\s*ng\/mL/);
  });

  it("preserves values and cites the source line", () => {
    const s = demo();
    const doc = s.documents.find((d) => d.title === "Complete blood count and thyroid panel")!;
    const exp = explainReport(doc, s.observations, "detailed");
    const documented = exp.sections.find((x) => x.kind === "documented")!;
    const tsh = documented.items.find((i) => i.text.startsWith("TSH"))!;
    expect(tsh.text).toContain("4.6 mIU/L");
    expect(tsh.text).toContain("0.4 - 4.0");
    expect(tsh.citation?.line).toMatch(/^TSH\s+4\.6/);
  });

  it("marks unverified values and separates documented facts from general information", () => {
    const s = demo();
    const doc = s.documents.find((d) => d.title === "Complete blood count and thyroid panel")!;
    const exp = explainReport(doc, s.observations, "simple");
    expect(exp.sections.map((x) => x.kind)).toEqual(expect.arrayContaining(["notice", "documented", "general", "unknown"]));
    expect(exp.sections.find((x) => x.kind === "documented")!.items.some((i) => i.uncertain)).toBe(true);
  });

  it("never diagnoses or recommends treatment", () => {
    const s = demo();
    for (const doc of s.documents.filter((d) => d.category === "lab_report"))
      for (const mode of ["simple", "detailed", "summary", "questions"] as const) {
        const text = flat(explainReport(doc, s.observations, mode));
        expect(text).not.toMatch(/you have (a |an )?\w*(disease|diabetes|hypothyroidism|anemia)|you are (healthy|unhealthy)|you should (take|stop|start|increase|decrease)/i);
      }
  });

  it("explains a document with no results honestly", () => {
    const s = demo();
    const doc = s.documents.find((d) => d.category === "vaccination")!;
    expect(flat(explainReport(doc, s.observations, "simple"))).toMatch(/will not guess/);
  });
});
