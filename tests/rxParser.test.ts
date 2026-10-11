import { describe, expect, it } from "vitest";
import { parsePrescription, parseRxLine } from "@/lib/extraction/rxParser";

describe("prescription extraction", () => {
  it("extracts explicit details", () => {
    expect(parseRxLine("1. Tab. Metformin 500 mg - 1 tablet twice daily after food x 90 days")).toMatchObject({
      medicineName: "Metformin", dosageForm: "Tablet", strength: "500 mg", dose: "1 tablet", frequencyText: "Twice daily", dosesPerDay: 2, foodInstruction: "after food", durationText: "90 days", reviewReasons: [],
    });
  });

  it("never guesses a missing dose or frequency", () => {
    const r = parseRxLine("Tab. Amlodipine 5 mg")!;
    expect(r.dose).toBeUndefined();
    expect(r.frequencyText).toBeUndefined();
    expect(r.dosesPerDay).toBeUndefined();
    expect(r.reviewReasons.join()).toMatch(/Dose not stated/);
    expect(r.reviewReasons.join()).toMatch(/Frequency not stated/);
  });

  it("flags abbreviations and numeric patterns for confirmation", () => {
    expect(parseRxLine("Tab Levothyroxine 50 mcg 1 tablet OD")!.reviewReasons.join()).toMatch(/abbreviation/);
    expect(parseRxLine("Tab Atorvastatin 10mg 1 tablet 0-0-1")!.reviewReasons.join()).toMatch(/numbers/);
  });

  it("marks as-needed medicines without a schedule", () => {
    const r = parseRxLine("Syp. Paracetamol 250 mg 5 ml SOS")!;
    expect(r.asNeeded).toBe(true);
    expect(r.dosesPerDay).toBeUndefined();
  });

  it("flags ug as a possible µg/mg confusion", () => {
    expect(parseRxLine("Tab Levothyroxine 50 ug 1 tablet once daily")!.reviewReasons.join()).toMatch(/µg/);
  });

  it("reads prescriber and date lines", () => {
    const p = parsePrescription("Dr. Sample Person\nDate: 20 Sep 2026\n1. Tab. Metformin 500 mg 1 tablet twice daily");
    expect(p.prescriber).toBe("Dr. Sample Person");
    expect(p.date).toBe("20 Sep 2026");
    expect(p.items).toHaveLength(1);
  });
});
