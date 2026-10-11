import { describe, expect, it } from "vitest";
import { detectCategory, ingestText } from "@/lib/ingest";
import { labDoc, demo } from "./helpers";

describe("document processing", () => {
  it("is processed only when results were extracted without uncertainty", () => {
    expect(ingestText(labDoc("p", ""), ["TSH 2.1 mIU/L 0.4-4.0"]).document.status).toBe("processed");
    expect(ingestText(labDoc("p", ""), ["Ferritin 45"]).document.status).toBe("needs_review");
    expect(ingestText(labDoc("p", ""), ["nothing useful here"]).document.status).toBe("needs_review");
  });

  it("keeps the original extraction in history", () => {
    const r = ingestText(labDoc("p", ""), ["TSH 2.1 mIU/L 0.4-4.0"]);
    expect(r.observations[0].history).toEqual([expect.objectContaining({ value: "2.1 mIU/L", by: "extraction" })]);
  });

  it("creates prescriptions as drafts that need verification", () => {
    const r = ingestText({ ...labDoc("p", ""), category: "prescription" }, ["Tab. Metformin 500 mg 1 tablet twice daily"]);
    expect(r.prescription?.status).toBe("draft");
    expect(r.prescription?.items.every((i) => !i.verified)).toBe(true);
    expect(r.document.status).toBe("needs_review");
  });

  it("detects common document types", () => {
    expect(detectCategory("Hemoglobin 13 g/dL reference 13-17")).toBe("lab_report");
    expect(detectCategory("Rx\nTab. Metformin 500 mg BD")).toBe("prescription");
    expect(detectCategory("Discharge summary")).toBe("discharge");
  });

  it("demo data is clearly synthetic", () => {
    const s = demo();
    expect(s.mode).toBe("demo");
    expect(s.documents.every((d) => d.isDemo && /SYNTHETIC|SAMPLE/.test(d.pages?.[0] ?? ""))).toBe(true);
    expect(s.profiles.every((p) => /Sample/.test(p.displayName))).toBe(true);
  });
});
