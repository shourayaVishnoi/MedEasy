import type { ISODate } from "../types";

/**
 * Deterministic laboratory-report parser.
 *
 * It preserves the original wording and numbers of every line it reads and
 * attaches a confidence score plus explicit review reasons. It never invents
 * reference intervals, units or values: anything it cannot read confidently is
 * flagged for human review rather than silently confirmed.
 */

export interface ParsedLabResult {
  testName: string;
  testKey: string;
  valueText: string;
  value: number | null;
  unit?: string;
  refText?: string;
  refLow?: number;
  refHigh?: number;
  flag: "H" | "L" | null;
  page: number;
  sourceLine: string;
  confidence: number;
  reviewReasons: string[];
}

export interface ParsedMetaField {
  key: "patientName" | "documentDate" | "laboratory" | "doctor";
  value: string;
  normalized?: string;
  confidence: number;
  reviewReasons: string[];
  page: number;
}

export interface LabParseResult {
  results: ParsedLabResult[];
  meta: ParsedMetaField[];
  unparsedLineCount: number;
}

const OCR_CONFUSABLE = /[OoIlS]/;
const UNIT_RE = /^(?:\/?[a-zA-Zµμ%][a-zA-Z0-9µμ%/^.*³²]*|10\^?\d+\/[a-zA-Z]+)$/;
const FLAG_RE = /^(?:\*|H|L|HIGH|LOW|\(H\)|\(L\)|\[H\]|\[L\])$/i;
const META_PATTERNS: { key: ParsedMetaField["key"]; re: RegExp }[] = [
  { key: "patientName", re: /^\s*(?:patient(?:'s)?\s*name|patient|name)\s*[:\-]\s*(.+)$/i },
  { key: "documentDate", re: /^\s*(?:report(?:ed)?\s*date|collection\s*date|sample\s*date|collected(?:\s*on)?|date)\s*[:\-]\s*(.+)$/i },
  { key: "laboratory", re: /^\s*(?:lab(?:oratory)?(?:\s*name)?)\s*[:\-]\s*(.+)$/i },
  { key: "doctor", re: /^\s*(?:ref(?:erring|erred)?\s*(?:by|doctor|physician)?|doctor|physician|consultant)\s*[:\-]\s*(.+)$/i },
];
const SKIP_LINE = /^\s*(?:test|investigation|parameter)s?\b.*\b(?:result|value)\b/i;

/** Spelling variants of the *same* test only. Different tests are never merged. */
const TEST_ALIASES: Record<string, string> = {
  haemoglobin: "hemoglobin",
  hb: "hemoglobin",
  thyroidstimulatinghormone: "tsh",
  tshthyroidstimulatinghormone: "tsh",
  glycatedhemoglobin: "hba1c",
  glycatedhaemoglobin: "hba1c",
  hemoglobina1c: "hba1c",
  "25ohvitamind": "25ohvitamind",
  vitamind25hydroxy: "25ohvitamind",
  "25hydroxyvitamind": "25ohvitamind",
};

export function normalizeTestKey(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/haem/g, "hem")
    .replace(/[^a-z0-9]/g, "");
  return TEST_ALIASES[key] ?? key;
}

export function normalizeUnit(unit: string | undefined): string {
  if (!unit) return "";
  return unit.replace(/μ/g, "µ").replace(/\s+/g, "").toLowerCase();
}

/** Parse a date string. Ambiguous numeric day/month orders are flagged, never guessed silently. */
export function parseReportDate(raw: string): { iso?: ISODate; ambiguous: boolean } {
  const s = raw.trim();
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { iso: iso(+m[1], +m[2], +m[3]), ambiguous: false };
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  m = s.match(/(\d{1,2})[\s\-/.]*([A-Za-z]{3,9})[\s\-/.,]*(\d{4})/);
  if (m) {
    const mon = months.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mon >= 0) return { iso: iso(+m[3], mon + 1, +m[1]), ambiguous: false };
  }
  m = s.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mon = months.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mon >= 0) return { iso: iso(+m[3], mon + 1, +m[2]), ambiguous: false };
  }
  m = s.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    // Day-first is assumed only when unambiguous; otherwise flag for review.
    if (a > 12 && b <= 12) return { iso: iso(+m[3], b, a), ambiguous: false };
    if (b > 12 && a <= 12) return { iso: iso(+m[3], a, b), ambiguous: false };
    return { iso: iso(+m[3], b, a), ambiguous: a !== b };
  }
  return { ambiguous: true };
}

function iso(y: number, m: number, d: number): ISODate | undefined {
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseNumber(token: string): { value: number | null; reasons: string[] } {
  const reasons: string[] = [];
  let t = token.replace(/^[<>]=?/, "").trim();
  if (OCR_CONFUSABLE.test(t)) {
    reasons.push("Possible OCR character confusion in the value (for example O/0 or l/1)");
    t = t.replace(/[Oo]/g, "0").replace(/[Il]/g, "1").replace(/S/g, "5");
  }
  if (/,/.test(t)) {
    // Western (1,000,000) and South Asian (10,00,000) digit grouping.
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) || /^\d{1,2}(,\d{2})*,\d{3}(\.\d+)?$/.test(t)) {
      t = t.replace(/,/g, "");
    } else {
      reasons.push("Ambiguous decimal separator (comma)");
      t = t.replace(",", ".");
    }
  }
  if ((t.match(/\./g) ?? []).length > 1) {
    reasons.push("More than one decimal point");
    return { value: null, reasons };
  }
  const v = Number(t);
  return { value: Number.isFinite(v) ? v : null, reasons };
}

function looksNumeric(token: string): boolean {
  const t = token.replace(/^[<>]=?/, "");
  return /\d/.test(t) && /^[0-9OoIlS.,]+$/.test(t) && !/^[OoIlS.,]+$/.test(t);
}

const RANGE_RE = /(?:\(|\[)?\s*(?:ref(?:erence)?(?:\s*(?:range|interval))?\s*[:\-]?\s*)?(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(?:\)|\])?/i;
const BOUND_RE = /(?:\(|\[)?\s*(?:ref(?:erence)?(?:\s*(?:range|interval))?\s*[:\-]?\s*)?(<=|>=|<|>|≤|≥)\s*(\d+(?:\.\d+)?)\s*(?:\)|\])?\s*$/i;

export function parseLabLine(line: string, page: number, baseConfidence = 0.96): ParsedLabResult | null {
  const original = line.replace(/\s+$/, "");
  if (!original.trim() || SKIP_LINE.test(original)) return null;
  let rest = original;

  // Reference interval: take the LAST range on the line so values like "B12" aren't mistaken.
  let refText: string | undefined;
  let refLow: number | undefined;
  let refHigh: number | undefined;
  const ranges = [...rest.matchAll(new RegExp(RANGE_RE, "gi"))];
  const lastRange = ranges.at(-1);
  if (lastRange && lastRange.index !== undefined && lastRange.index > 0) {
    // Ignore a "range" that is the very first number (it would then be the value).
    const before = rest.slice(0, lastRange.index);
    if (before.split(/\s+/).some(looksNumeric)) {
      refText = lastRange[0].replace(/[()[\]]/g, "").replace(/^\s*ref(?:erence)?(?:\s*(?:range|interval))?\s*[:\-]?\s*/i, "").trim();
      refLow = Number(lastRange[1]);
      refHigh = Number(lastRange[2]);
      rest = rest.slice(0, lastRange.index) + rest.slice(lastRange.index + lastRange[0].length);
    }
  }
  if (!refText) {
    const b = rest.match(BOUND_RE);
    if (b && b.index !== undefined && rest.slice(0, b.index).split(/\s+/).some(looksNumeric)) {
      refText = `${b[1]} ${b[2]}`;
      if (b[1].startsWith("<") || b[1] === "≤") refHigh = Number(b[2]);
      else refLow = Number(b[2]);
      rest = rest.slice(0, b.index);
    }
  }

  const tokens = rest.replace(/:/g, " ").split(/\s+/).filter(Boolean);
  const valueIdx = tokens.findIndex((t, i) => i > 0 && looksNumeric(t));
  if (valueIdx < 1) return null;
  const testName = tokens.slice(0, valueIdx).join(" ").replace(/[\-–:]+$/, "").trim();
  if (!/[a-zA-Z]{2,}/.test(testName)) return null;

  const valueText = tokens[valueIdx];
  const reviewReasons: string[] = [];
  let confidence = baseConfidence;
  const parsed = parseNumber(valueText);
  if (parsed.reasons.length) {
    reviewReasons.push(...parsed.reasons);
    confidence -= 0.4;
  }

  let unit: string | undefined;
  let flag: "H" | "L" | null = null;
  for (const t of tokens.slice(valueIdx + 1)) {
    if (FLAG_RE.test(t)) {
      const u = t.replace(/[()[\]]/g, "").toUpperCase();
      flag = u.startsWith("H") ? "H" : u.startsWith("L") ? "L" : flag;
      if (u === "*") reviewReasons.push("Result marked with '*' – meaning not stated on this line");
    } else if (!unit && UNIT_RE.test(t)) {
      unit = t;
    }
  }

  if (!unit) {
    reviewReasons.push("Unit missing – the value cannot be interpreted without it");
    confidence -= 0.25;
  } else if (/^u[gl]?\//i.test(unit) || /^ug/i.test(unit)) {
    reviewReasons.push("Check the unit: 'u' may be a misread 'µ' (for example µg vs mg)");
    confidence -= 0.15;
  }

  if (parsed.value !== null && refHigh !== undefined && refLow !== undefined && refHigh > 0) {
    if (parsed.value > refHigh * 10 || (refLow > 0 && parsed.value < refLow / 10)) {
      reviewReasons.push("Value is more than ten times outside the reference interval – check the decimal point");
      confidence -= 0.35;
    }
  }

  return {
    testName,
    testKey: normalizeTestKey(testName),
    valueText,
    value: parsed.value,
    unit,
    refText,
    refLow,
    refHigh,
    flag,
    page,
    sourceLine: original.trim(),
    confidence: Math.max(0, Math.round(confidence * 100) / 100),
    reviewReasons,
  };
}

export function parseLabReport(pages: string[], opts: { ocr?: boolean } = {}): LabParseResult {
  const base = opts.ocr ? 0.82 : 0.96;
  const results: ParsedLabResult[] = [];
  const meta: ParsedMetaField[] = [];
  let unparsed = 0;
  pages.forEach((text, i) => {
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const metaHit = META_PATTERNS.find((p) => p.re.test(line));
      if (metaHit && !meta.some((m) => m.key === metaHit.key)) {
        const value = line.match(metaHit.re)![1].trim();
        const field: ParsedMetaField = { key: metaHit.key, value, confidence: base, reviewReasons: [], page: i + 1 };
        if (metaHit.key === "documentDate") {
          const d = parseReportDate(value);
          field.normalized = d.iso;
          if (!d.iso) {
            field.reviewReasons.push("Date could not be read");
            field.confidence -= 0.5;
          } else if (d.ambiguous) {
            field.reviewReasons.push("Day and month order is ambiguous – please confirm the date");
            field.confidence -= 0.3;
          }
        }
        meta.push(field);
        continue;
      }
      if (metaHit) continue;
      const r = parseLabLine(line, i + 1, base);
      if (r) results.push(r);
      else unparsed++;
    }
  });
  return { results, meta, unparsedLineCount: unparsed };
}

export function needsReview(r: { confidence: number; reviewReasons: string[] }): boolean {
  return r.confidence < 0.8 || r.reviewReasons.length > 0;
}
