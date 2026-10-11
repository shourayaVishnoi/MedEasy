import type { LabObservation } from "../types";
import { normalizeUnit } from "../extraction/labParser";

export interface ComparableSeries {
  key: string;
  testName: string;
  testKey: string;
  unit: string;
  points: LabObservation[];
  notes: string[];
}

export interface ComparisonResult {
  series: ComparableSeries[];
  /** Same test recorded with different units: shown, but never merged without a validated conversion. */
  incomparable: { testName: string; units: string[]; observations: LabObservation[] }[];
}

/**
 * Group observations into series that are meaningfully comparable:
 * same normalised test AND same unit. Values without a parsed number are kept
 * out of the chart but still listed.
 */
export function buildComparisons(observations: LabObservation[]): ComparisonResult {
  const byTest = new Map<string, LabObservation[]>();
  for (const o of observations) {
    if (!byTest.has(o.testKey)) byTest.set(o.testKey, []);
    byTest.get(o.testKey)!.push(o);
  }
  const series: ComparableSeries[] = [];
  const incomparable: ComparisonResult["incomparable"] = [];
  for (const [testKey, obs] of byTest) {
    const byUnit = new Map<string, LabObservation[]>();
    for (const o of obs) {
      const u = normalizeUnit(o.unit);
      if (!byUnit.has(u)) byUnit.set(u, []);
      byUnit.get(u)!.push(o);
    }
    const units = [...byUnit.keys()];
    if (units.length > 1) {
      incomparable.push({ testName: obs[0].testName, units: units.map((u) => u || "(no unit)"), observations: obs });
    }
    for (const [u, points] of byUnit) {
      if (!u) continue; // a value without a unit cannot be compared
      const sorted = [...points].sort((a, b) => (a.observedOn ?? "").localeCompare(b.observedOn ?? ""));
      const notes: string[] = [];
      const refs = new Set(sorted.map((p) => p.refText ?? "none"));
      if (refs.size > 1) notes.push("The laboratory reference interval differs between reports. Each point keeps its own interval.");
      if (sorted.some((p) => p.verification === "extracted" && p.reviewReasons.length > 0))
        notes.push("Some values are unverified extractions and are marked.");
      if (sorted.some((p) => p.verification === "corrected")) notes.push("Some values were corrected by you; the original extraction is kept in history.");
      series.push({ key: `${testKey}|${u}`, testName: sorted.at(-1)!.testName, testKey, unit: sorted[0].unit ?? u, points: sorted, notes });
    }
  }
  series.sort((a, b) => b.points.length - a.points.length || a.testName.localeCompare(b.testName));
  return { series, incomparable };
}

/** Neutral description of the change between two comparable measurements. Never a judgement. */
export function describeChange(prev: LabObservation, curr: LabObservation): string {
  if (prev.value === null || curr.value === null) return "One of these values could not be read as a number, so no change is calculated.";
  const unverified = [prev, curr].some((o) => o.verification === "extracted" && o.reviewReasons.length > 0);
  const caveat = unverified ? " One of these values is an unverified extraction, so check it against the original report before relying on this change." : "";
  const delta = curr.value - prev.value;
  const unit = curr.unit ? ` ${curr.unit}` : "";
  const round = (n: number) => Math.round(n * 100) / 100;
  if (delta === 0) return `The recorded value is unchanged from the previous test (${curr.valueText}${unit}).${caveat}`;
  const dir = delta > 0 ? "increased" : "decreased";
  return `The recorded value ${dir} by ${round(Math.abs(delta))}${unit} from the previous test (${prev.valueText} → ${curr.valueText}${unit}).${caveat}`;
}

export function relationToInterval(o: LabObservation): "below" | "within" | "above" | "unknown" {
  if (o.value === null || (o.refLow === undefined && o.refHigh === undefined)) return "unknown";
  if (o.refLow !== undefined && o.value < o.refLow) return "below";
  if (o.refHigh !== undefined && o.value > o.refHigh) return "above";
  return "within";
}
