/**
 * Prescription line parser.
 *
 * Rules (from the product brief): never guess a dose, never invent a frequency,
 * never infer missing instructions from common practice. Abbreviations are
 * expanded only when they have a single standard meaning, and are still
 * flagged so the user confirms them against the original.
 */

export interface ParsedRxItem {
  medicineName: string;
  dosageForm?: string;
  strength?: string;
  dose?: string;
  route?: string;
  frequencyText?: string;
  /** Number of doses per day when explicitly stated; undefined when not determinable. */
  dosesPerDay?: number;
  asNeeded: boolean;
  foodInstruction?: string;
  durationText?: string;
  sourceLine: string;
  confidence: number;
  reviewReasons: string[];
}

const FORMS: Record<string, string> = {
  tab: "Tablet", tablet: "Tablet", tabs: "Tablet",
  cap: "Capsule", capsule: "Capsule", caps: "Capsule",
  syp: "Syrup", syrup: "Syrup",
  inj: "Injection", injection: "Injection",
  drops: "Drops", drop: "Drops",
  cream: "Cream", oint: "Ointment", ointment: "Ointment",
  inhaler: "Inhaler", susp: "Suspension", suspension: "Suspension",
};

const ROUTE_BY_FORM: Record<string, string> = { Tablet: "Oral", Capsule: "Oral", Syrup: "Oral", Suspension: "Oral" };

const FREQ_PHRASES: { re: RegExp; text: string; perDay?: number; abbreviation?: boolean; asNeeded?: boolean }[] = [
  { re: /\bonce\s+(?:a\s+)?daily\b|\bonce\s+a\s+day\b/i, text: "Once daily", perDay: 1 },
  { re: /\btwice\s+(?:a\s+)?daily\b|\btwice\s+a\s+day\b/i, text: "Twice daily", perDay: 2 },
  { re: /\b(?:three|3)\s+times\s+(?:a\s+)?(?:daily|day)\b/i, text: "Three times daily", perDay: 3 },
  { re: /\b(?:four|4)\s+times\s+(?:a\s+)?(?:daily|day)\b/i, text: "Four times daily", perDay: 4 },
  { re: /\bonce\s+(?:a\s+)?week(?:ly)?\b/i, text: "Once weekly" },
  { re: /\bevery\s+(\d+)\s+hours?\b/i, text: "Every $1 hours" },
  { re: /\bat\s+bed\s*time\b|\bat\s+night\b/i, text: "At bedtime", perDay: 1 },
  { re: /\bas\s+needed\b|\bwhen\s+required\b/i, text: "As needed", asNeeded: true },
  { re: /\b(?:OD|QD)\b/, text: "Once daily (abbreviation)", perDay: 1, abbreviation: true },
  { re: /\b(?:BD|BID)\b/, text: "Twice daily (abbreviation)", perDay: 2, abbreviation: true },
  { re: /\b(?:TDS|TID)\b/, text: "Three times daily (abbreviation)", perDay: 3, abbreviation: true },
  { re: /\bQID\b/, text: "Four times daily (abbreviation)", perDay: 4, abbreviation: true },
  { re: /\bHS\b/, text: "At bedtime (abbreviation)", perDay: 1, abbreviation: true },
  { re: /\b(?:SOS|PRN)\b/, text: "As needed (abbreviation)", asNeeded: true, abbreviation: true },
];

export function parseRxLine(raw: string): ParsedRxItem | null {
  const line = raw.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, "").trim();
  if (!line) return null;
  const reviewReasons: string[] = [];
  let confidence = 0.95;

  const formMatch = line.match(/^(tab(?:let)?s?|caps?(?:ule)?|syp|syrup|inj(?:ection)?|drops?|cream|oint(?:ment)?|inhaler|susp(?:ension)?)\.?\s+/i);
  const dosageForm = formMatch ? FORMS[formMatch[1].toLowerCase().replace(/\.$/, "")] ?? formMatch[1] : undefined;
  const body = formMatch ? line.slice(formMatch[0].length) : line;

  const strengthMatch = body.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|μg|ug|g|ml|iu|units?|%)\b/i);
  const nameEnd = strengthMatch?.index ?? body.search(/\s[-–—]\s|\d/);
  const medicineName = (nameEnd > 0 ? body.slice(0, nameEnd) : body.split(/\s+/).slice(0, 2).join(" ")).replace(/[,\-–—]+$/, "").trim();
  if (!/[a-zA-Z]{3,}/.test(medicineName)) return null;

  let strength: string | undefined;
  if (strengthMatch) {
    strength = `${strengthMatch[1]} ${strengthMatch[2]}`;
    if (/^ug$/i.test(strengthMatch[2])) {
      reviewReasons.push("Strength unit 'ug' may mean µg (mcg) – confirm against the original");
      confidence -= 0.2;
    }
  } else {
    reviewReasons.push("Strength not found");
    confidence -= 0.15;
  }

  const afterStrength = strengthMatch ? body.slice((strengthMatch.index ?? 0) + strengthMatch[0].length) : body;
  const doseMatch = afterStrength.match(/\b(\d+(?:\.\d+)?|½|half|one|two|three)\s*(tablets?|tabs?|capsules?|caps?|ml|puffs?|drops?|units?|sachets?)\b/i);
  const dose = doseMatch ? doseMatch[0] : undefined;
  if (!dose) {
    reviewReasons.push("Dose not stated – MedEasy will not guess it");
    confidence -= 0.3;
  }

  let frequencyText: string | undefined;
  let dosesPerDay: number | undefined;
  let asNeeded = false;
  const pattern = afterStrength.match(/\b([0-2](?:\.5)?|½)\s*-\s*([0-2](?:\.5)?|½)\s*-\s*([0-2](?:\.5)?|½)\b/);
  if (pattern) {
    const slots = ["morning", "afternoon", "night"].filter((_, i) => pattern[i + 1] !== "0");
    frequencyText = `${pattern[0]} (${slots.join(", ")})`;
    dosesPerDay = slots.length;
    reviewReasons.push("Dosing pattern written as numbers – confirm what each position means with your prescriber or pharmacist");
    confidence -= 0.1;
  } else {
    for (const f of FREQ_PHRASES) {
      const m = afterStrength.match(f.re);
      if (m) {
        frequencyText = f.text.replace("$1", m[1] ?? "");
        dosesPerDay = f.perDay;
        asNeeded = !!f.asNeeded;
        if (f.abbreviation) {
          reviewReasons.push("Frequency written as an abbreviation – confirm it with your prescriber or pharmacist");
          confidence -= 0.1;
        }
        break;
      }
    }
  }
  if (!frequencyText) {
    reviewReasons.push("Frequency not stated – a schedule cannot be created until it is confirmed");
    confidence -= 0.3;
  }

  const food = afterStrength.match(/\b(after|before|with)\s+(food|meals?|breakfast|lunch|dinner)\b|\bon\s+an?\s+empty\s+stomach\b/i);
  const duration = afterStrength.match(/(?:\bx\s*|\bfor\s+)(\d+)\s*(days?|weeks?|months?)\b/i);
  const routeMatch = afterStrength.match(/\b(oral(?:ly)?|by mouth|topical(?:ly)?|subcutaneous(?:ly)?|intramuscular|inhaled|eye|ear|nasal)\b/i);

  return {
    medicineName,
    dosageForm,
    strength,
    dose,
    route: routeMatch ? routeMatch[1] : dosageForm ? ROUTE_BY_FORM[dosageForm] : undefined,
    frequencyText,
    dosesPerDay,
    asNeeded,
    foodInstruction: food ? food[0] : undefined,
    durationText: duration ? `${duration[1]} ${duration[2]}` : undefined,
    sourceLine: raw.trim(),
    confidence: Math.max(0, Math.round(confidence * 100) / 100),
    reviewReasons,
  };
}

export interface RxParseResult {
  prescriber?: string;
  date?: string;
  items: ParsedRxItem[];
}

export function parsePrescription(text: string): RxParseResult {
  const result: RxParseResult = { items: [] };
  for (const line of text.split(/\r?\n/)) {
    const doc = line.match(/^\s*(?:dr\.?|doctor|prescriber|prescribed\s+by)\s*[:\-]?\s*(.+)$/i);
    if (doc && !result.prescriber) {
      result.prescriber = /^dr/i.test(line.trim()) ? line.trim() : doc[1].trim();
      continue;
    }
    const date = line.match(/^\s*date\s*[:\-]\s*(.+)$/i);
    if (date && !result.date) {
      result.date = date[1].trim();
      continue;
    }
    if (/^\s*(?:patient|name|age|diagnosis|rx|advice|signature)\b/i.test(line)) continue;
    const item = parseRxLine(line);
    if (item && (item.strength || item.dose || item.frequencyText || item.dosageForm)) result.items.push(item);
  }
  return result;
}
