import { describe, expect, it } from "vitest";
import { needsReview, normalizeTestKey, parseLabLine, parseLabReport, parseReportDate } from "@/lib/extraction/labParser";

describe("lab report extraction", () => {
  it("preserves value, unit and reference interval exactly", () => {
    const r = parseLabLine("Hemoglobin   13.1   g/dL   13.0 - 17.0", 1)!;
    expect(r).toMatchObject({ testName: "Hemoglobin", valueText: "13.1", value: 13.1, unit: "g/dL", refText: "13.0 - 17.0", refLow: 13, refHigh: 17, flag: null });
    expect(needsReview(r)).toBe(false);
  });

  it("does not mistake digits in test names for values", () => {
    expect(parseLabLine("Vitamin B12  450 pg/mL 200-900", 1)).toMatchObject({ testName: "Vitamin B12", value: 450 });
    expect(parseLabLine("25-OH Vitamin D  18.2  ng/mL  L  30 - 100", 1)).toMatchObject({ testName: "25-OH Vitamin D", value: 18.2, flag: "L" });
  });

  it("flags a missing unit for review", () => {
    const r = parseLabLine("Ferritin 45", 1)!;
    expect(r.unit).toBeUndefined();
    expect(needsReview(r)).toBe(true);
    expect(r.reviewReasons.join()).toMatch(/Unit missing/);
  });

  it("never invents a reference interval", () => {
    const r = parseLabLine("Ferritin 45 ng/mL", 1)!;
    expect(r.refText).toBeUndefined();
    expect(r.refLow).toBeUndefined();
    expect(r.refHigh).toBeUndefined();
  });

  it("flags OCR character confusion such as O for 0", () => {
    const r = parseLabLine("TSH 2.5O mIU/L 0.4-4.0", 1)!;
    expect(r.valueText).toBe("2.5O"); // original wording preserved
    expect(needsReview(r)).toBe(true);
  });

  it("flags likely decimal-point errors (10x outside interval)", () => {
    const r = parseLabLine("Creatinine 98 mg/dL 0.6-1.2", 1)!;
    expect(r.reviewReasons.join()).toMatch(/decimal point/);
  });

  it("flags ambiguous decimal commas but understands digit grouping", () => {
    expect(parseLabLine("Glucose 5,6 mmol/L 3.9-5.5", 1)!.reviewReasons.join()).toMatch(/decimal separator/);
    expect(parseLabLine("Platelet Count 2,10,000 /µL 150000-410000", 1)).toMatchObject({ value: 210000, unit: "/µL" });
    expect(parseLabLine("Total WBC Count 7,800 /µL 4000-11000", 1)).toMatchObject({ value: 7800 });
  });

  it("flags mcg/µg unit ambiguity", () => {
    expect(parseLabLine("Folate 12 ug/L 3-17", 1)!.reviewReasons.join()).toMatch(/µ/);
  });

  it("handles one-sided intervals", () => {
    expect(parseLabLine("LDL Cholesterol 128 mg/dL <100", 1)).toMatchObject({ refHigh: 100, refLow: undefined });
  });

  it("reads report metadata and flags ambiguous dates", () => {
    const res = parseLabReport(["Patient Name: Test Person\nReport Date: 03/04/2026\nLaboratory: Example Lab\nTSH 2.1 mIU/L 0.4-4.0"]);
    expect(res.results).toHaveLength(1);
    const date = res.meta.find((m) => m.key === "documentDate")!;
    expect(date.reviewReasons.join()).toMatch(/ambiguous/);
    expect(res.meta.find((m) => m.key === "laboratory")!.value).toBe("Example Lab");
  });

  it("parses unambiguous date formats", () => {
    expect(parseReportDate("18-Sep-2026")).toEqual({ iso: "2026-09-18", ambiguous: false });
    expect(parseReportDate("2026-01-14")).toEqual({ iso: "2026-01-14", ambiguous: false });
    expect(parseReportDate("25/12/2026")).toEqual({ iso: "2026-12-25", ambiguous: false });
    expect(parseReportDate("Sep 3, 2026").iso).toBe("2026-09-03");
  });

  it("only merges spelling variants of the same test", () => {
    expect(normalizeTestKey("Haemoglobin")).toBe(normalizeTestKey("Hemoglobin"));
    expect(normalizeTestKey("Free T4")).not.toBe(normalizeTestKey("Total T4"));
  });

  it("OCR input lowers confidence", () => {
    const text = parseLabReport(["TSH 2.1 mIU/L 0.4-4.0"]).results[0].confidence;
    const ocr = parseLabReport(["TSH 2.1 mIU/L 0.4-4.0"], { ocr: true }).results[0].confidence;
    expect(ocr).toBeLessThan(text);
  });
});
