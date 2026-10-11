export { parseLabReport, parseLabLine, parseReportDate, normalizeTestKey, normalizeUnit, needsReview } from "./labParser";
export { parsePrescription, parseRxLine } from "./rxParser";
import { parseReportDate } from "./labParser";

export function parseReportDateSafe(raw: string): string | undefined {
  return parseReportDate(raw).iso;
}
