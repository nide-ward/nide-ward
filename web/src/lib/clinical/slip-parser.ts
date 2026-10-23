export interface ParsedSlip {
  ph?: number;
  pco2?: number;
  po2?: number;
  hco3?: number;
  hco3std?: number;
  na?: number;
  k?: number;
  cl?: number;
  ca?: number;
  rbg?: number;
  hb?: number;
}

type SlipRange = readonly [minimum: number, maximum: number];

function valueInRange(line: string, [minimum, maximum]: SlipRange): number | undefined {
  // Remove analyser labels before looking for values. This prevents the "02" in pCO2 or HCO3
  // from becoming a plausible clinical value when the left edge of a GEM slip is clipped.
  const tokens = line
    .replace(/\S*[a-z]\S*/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  // An orphaned ".1" means OCR inserted a space inside a decimal such as "27 .1"; decline the
  // row rather than accepting the truncated integer part "27".
  if (tokens.some((token) => /^\.\d+$/.test(token))) return undefined;
  const values = tokens
    .filter((token) => /^[+-]?\d+(?:\.\d+)?$/.test(token))
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= minimum && value <= maximum);
  return values.length === 1 ? values[0] : undefined;
}

function isMmolLine(line: string): boolean {
  return /mmo/i.test(line);
}

const GAS_UNIT_PATTERN = /(?:mm\s*h|m[ma][ih]g?|matg|nntig)/i;

function isGasUnitLine(line: string): boolean {
  // "nntig" is the observed OCR confusion for mmHg. It is accepted only as one of the two
  // consecutive GEM gas rows below, never as a free-text fallback.
  return GAS_UNIT_PATTERN.test(line);
}

function gasRowValue(line: string, range: SlipRange): number | undefined {
  // Clipped GEM ">O2" can be misread as all-digit "02", "202", or "502". Strip that leading label
  // unless it sits directly before the gas unit (e.g. an unlabelled "202 mmHg" reading).
  const match = line.match(/^[|!1(\[{«©~-\s]*([01259]?02)\b(.*)$/);
  if (match && (match[1].startsWith("0") || !/^\s*(?:mm\s*h|m[ma][ih]g?|matg|nntig)\b/i.test(match[2]))) {
    return valueInRange(match[2], range);
  }
  return valueInRange(line, range);
}

function nextRow(lines: string[], index: number): string | undefined {
  return lines[index + 1];
}

/**
 * GEM 3000 slips always print their measurements in the same rows. The leftmost label is often
 * outside a phone photo, so use the two named sections, row order, units and tight clinical ranges
 * together. This intentionally declines an incomplete row sequence instead of shifting later rows.
 */
function parseGem3000Rows(lines: string[]): ParsedSlip | undefined {
  const derivedAt = lines.findIndex((line) => /(?:der|per)\s*ived\s+parameters/i.test(line));
  if (derivedAt === -1) return undefined;

  const measuredAt = lines.findIndex((line) => /meas\w*\s*\(\s*37/i.test(line));
  const measured = lines.slice(measuredAt === -1 ? 0 : measuredAt + 1, derivedAt);
  const derived = lines.slice(derivedAt + 1);
  const result: ParsedSlip = {};

  const phLine = measured.find((line) => /h/i.test(line) && /[67]\.\d/.test(line) && valueInRange(line, [6.5, 7.9]) !== undefined);
  if (phLine) result.ph = valueInRange(phLine, [6.5, 7.9]);

  const pco2Line = measured.find((line) => /(?:^|[^a-z]|9)[pc9>»]?\s*[c<g]\s*[o0]+\s*2\b/i.test(line));
  const po2Line = measured.find((line) => /(?:^|[^a-z0-9])[p>»]?\s*[o0]\s*2\b/i.test(line));
  if (pco2Line) result.pco2 = gasRowValue(pco2Line, [10, 150]);
  if (po2Line) result.po2 = gasRowValue(po2Line, [15, 500]);

  // A badly recognised O2 label can still be trusted when both gas rows and their units survived.
  const gasRows = measured.filter((line) => isGasUnitLine(line) && gasRowValue(line, [10, 500]) !== undefined);
  if (gasRows.length === 2) {
    result.pco2 ??= gasRowValue(gasRows[0], [10, 150]);
    result.po2 ??= gasRowValue(gasRows[1], [15, 500]);
  }

  // Bind Na, K and Ca as one uninterrupted trio. If any row is missing, do not let a later value
  // slide into its place.
  for (let index = 0; index < measured.length - 2; index++) {
    const sodium = measured[index];
    const potassium = nextRow(measured, index);
    const calcium = nextRow(measured, index + 1);
    if (!potassium || !calcium || !isMmolLine(sodium) || !isMmolLine(potassium) || !isMmolLine(calcium)) continue;
    const na = valueInRange(sodium, [100, 190]);
    const k = valueInRange(potassium, [1, 10]);
    const ca = valueInRange(calcium, [0.3, 5]);
    if (na === undefined || k === undefined || ca === undefined) continue;
    result.na ??= na;
    result.k ??= k;
    result.ca ??= ca;
    break;
  }

  const sodiumLine = measured.find((line) => /a\+(?!\+)/i.test(line));
  const potassiumLine = measured.find((line) => /\bk\s*\+/i.test(line));
  const calciumLine = measured.find((line) => /a\s*(?:\+\+|2\+)/i.test(line));
  if (sodiumLine) result.na ??= valueInRange(sodiumLine, [100, 190]);
  if (potassiumLine) result.k ??= valueInRange(potassiumLine, [1, 10]);
  if (calciumLine) result.ca ??= valueInRange(calciumLine, [0.3, 5]);

  const glucoseLine = measured.find((line) => /[g5s3i][l1i]u/i.test(line) && /mg\s*\/?\s*d[l1]/i.test(line));
  if (glucoseLine) result.rbg = valueInRange(glucoseLine, [20, 1200]);

  const hco3Line = derived.find((line) => /[h14i]?\s*[ce(6]\s*[o0]+\s*3/i.test(line) && !/std/i.test(line));
  const hco3StdLine = derived.find((line) => /[h14i]?\s*[ce(6]\s*[o0]+\s*3.*std/i.test(line));
  if (hco3Line) result.hco3 = valueInRange(hco3Line, [2, 55]);
  if (hco3StdLine) result.hco3std = valueInRange(hco3StdLine, [5, 50]);

  const hctLine = measured.find((line) => /[h1ij]?\s*ct\b/i.test(line));
  const hct = hctLine ? valueInRange(hctLine, [10, 80]) : undefined;
  const hbLine = derived.find(
    (line) => /(?:[t7f\[]\s*)?(?:h\s*o?\s*|m)[b8][ce]/i.test(line) && /(?<![a-z])g\s*\/?\s*d[l1]?/i.test(line),
  );
  const hb = hbLine ? valueInRange(hbLine, [3, 25]) : undefined;
  // Hb and Hct are printed together on GEM slips. A plausible ratio catches missing leading digits
  // such as OCR's "Hbc 7.7" for an Hct of 57, rather than placing a hazardous low Hb in the form.
  if (hct !== undefined && hb !== undefined && hct / hb >= 2.5 && hct / hb <= 3.7) result.hb = hb;
  return result;
}

function isLikelyGem3000(lines: string[]): boolean {
  return lines.some((line) => /\bgem\s*3000\b|meas\w*\s*\(\s*37|\bbeecf\b|\bthbc\b/i.test(line));
}

/**
 * Universal blood gas analyser slip parser.
 * Specifically trained and tuned for Instrumentation Laboratory GEM 3000 / GEM Premier,
 * Radiometer ABL, and Roche Cobas thermal printout slips.
 * Handles clipped left-edge prefixes (>H, >CO2, >O2), GEM 3000 aliases (Glu, THbc, HCO3-),
 * and thermal printer OCR character variants (0 vs O, l vs 1, + vs t).
 */
export function parseABGSlipText(text: string | null | undefined): ParsedSlip {
  if (!text) return {};
  const clean = text.replace(/,/g, ".");
  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const gemRows = parseGem3000Rows(lines);
  if (gemRows) return gemRows;
  if (isLikelyGem3000(lines)) return {};
  const results: ParsedSlip = {};

  // First pass: line-by-line analysis for structured thermal slips (Radiometer, Cobas)
  for (const line of lines) {
    // 1. pH (e.g. ">H 7.38", "pH 7.25", "PH: 7.31")
    if (results.ph === undefined) {
      const m = line.match(/^[>\)\]\|I!l1\s]*p?[Hh]\b[^\d]{0,8}([67]\.\d{1,3})/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 6.5 && v <= 7.9) results.ph = v;
      }
    }

    // 2. pCO2 (e.g. ">CO2 43 mmHg", "pCO2 31 mmHg", "pC02 29.4")
    if (results.pco2 === undefined) {
      const m = line.match(/^[>\)\]\|I!l1\s]*p?[Cck][O0o][2zZ]\b[^\d]{0,8}(\d{1,3}(?:\.\d)?)/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 10 && v <= 150) results.pco2 = v;
      }
    }

    // 3. pO2 (e.g. ">O2 35 mmHg", "pO2 30 mmHg")
    if (results.po2 === undefined) {
      const m = line.match(/^[>\)\]\|I!l1\s]*p?[O0o][2zZ]\b[^\d]{0,8}(\d{1,3}(?:\.\d)?)/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 15 && v <= 500) results.po2 = v;
      }
    }

    // 4. Sodium Na+ (e.g. "Na+ 128 mmol/L", "cNa+ 136")
    if (results.na === undefined) {
      const m = line.match(/^[>\)\]\|I!l1\s]*c?Na[\+\*t]?\b[^\d]{0,8}(\d{2,3}(?:\.\d)?)/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 100 && v <= 190) results.na = v;
      }
    }

    // 5. Potassium K+ (e.g. "K+ 3.4 mmol/L", "cK+ 3.9")
    if (results.k === undefined) {
      const m = line.match(/^[>\)\]\|I!l1\s]*c?K[\+\*t]?\b[^\d]{0,8}([1-9](?:\.\d{1,2})?)/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 1.0 && v <= 10.0) results.k = v;
      }
    }

    // 6. Calcium Ca++ (measured ionized, e.g. "Ca++ 3.48 mmol/L", "Ca++ 1.89", skip Ca++(7.4))
    if (results.ca === undefined && !line.includes("(7.4)")) {
      const m = line.match(/^[>\)\]\|I!l1\s]*c?Ca(?:\+\+|2\+|\+)?\b[^\d]{0,8}([0-4]\.\d{1,2})/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 0.3 && v <= 5.0) results.ca = v;
      }
    }

    // 7. Glucose / RBG (e.g. "Glu 68 mg/dL", "Glu 383 mg/dL", "cGlu 340")
    if (results.rbg === undefined) {
      const m = line.match(/^[>\)\]\|I!l1\s]*(?:c?Glu(?:cose)?|RBG|BG)\b[^\d]{0,8}(\d{2,4}(?:\.\d)?)/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 20 && v <= 1200) results.rbg = v;
      }
    }

    // 8. Chloride Cl- (e.g. "cCl- 99 mmol/L", "Cl- 102")
    if (results.cl === undefined) {
      const m = line.match(/^[>\)\]\|I!l1\s]*c?C[lI1][\-_]?\b[^\d]{0,8}(\d{2,3}(?:\.\d)?)/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 60 && v <= 150) results.cl = v;
      }
    }

    // 9. Standard Bicarbonate HCO3std / SBC (e.g. "HCO3std 23.8 mmol/L", "HCO3std 14.0")
    if (results.hco3std === undefined) {
      const m = line.match(/^[>\)\]\|I!l1\s]*(?:c?H[C\(][O0o]+3[\-_]?(?:\([^)]*st[^)]*\)|std|st)|SBC)\b[^\d]{0,8}(\d{1,2}(?:\.\d)?)/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 5 && v <= 50) results.hco3std = v;
      }
    }

    // 10. Actual Bicarbonate HCO3- (e.g. "HCO3- 25.4 mmol/L", "HCO3- 13.6", "cHCO3-(P) 11.2")
    if (results.hco3 === undefined) {
      const m = line.match(/^[>\)\]\|I!l1\s]*(?:c?H[C\(][O0o]+3[\-_]?(?!\w*std)(?:\(P\)|act)?|Bicarb(?:onate)?)\b[^\d]{0,8}(\d{1,2}(?:\.\d)?)/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 2 && v <= 55) results.hco3 = v;
      }
    }

    // 11. Hemoglobin Hb / THbc (e.g. "THbc 17.7 g/dL", "THbc 11.8 g/dL", "ctHb 13.5", "Hb 13.2")
    if (results.hb === undefined) {
      const m = line.match(/^[>\)\]\|I!l1\s]*(?:THbc|c?t?H[bg]c?|Hgb|Hemoglobin)\b[^\d]{0,8}(\d{1,2}(?:\.\d)?)/i);
      if (m) {
        const v = parseFloat(m[1]);
        if (!isNaN(v) && v >= 3.0 && v <= 25.0) results.hb = v;
      }
    }
  }

  // Second pass: full-text fallback extraction for any parameter not found on clean lines
  function extractValue(patterns: RegExp[], min?: number, max?: number): number | undefined {
    for (const pat of patterns) {
      const m = clean.match(pat);
      if (m && m[1]) {
        const val = parseFloat(m[1]);
        if (!isNaN(val) && (min === undefined || val >= min) && (max === undefined || val <= max)) {
          return val;
        }
      }
    }
    return undefined;
  }

  // 1. pH
  if (results.ph === undefined) {
    const phVal = extractValue([
      /(?:^|[\s\r\n])[>\)\]\|I!l1\s]*p?[Hh]\b\s*[:=]?\s*([67]\.\d{1,3})/i,
      /\b(?:p[Hh]|PH)\s*[:=]?\s*([67]\.\d{1,3})\b/i,
      /\b([67]\.\d{2,3})\b/,
    ], 6.5, 7.9);
    if (phVal !== undefined) results.ph = phVal;
  }

  // 2. pCO2
  if (results.pco2 === undefined) {
    const pco2Val = extractValue([
      /(?:^|[\s\r\n])[>\)\]\|I!l1\s]*p?[Cck][O0o][2zZ]\b[^\d\n\r]{0,15}?(\d{1,3}(?:\.\d)?)/i,
      /\b(?:p[Cck][O0o][2zZ]|pco2)[^\d\n\r]{0,15}?(\d{1,3}(?:\.\d)?)\b/i,
      /\b(?:pCO2|PCO2)\b[^\d]{0,20}(\d{1,3}(?:\.\d)?)/i,
    ], 10, 150);
    if (pco2Val !== undefined) results.pco2 = pco2Val;
  }

  // 3. pO2
  if (results.po2 === undefined) {
    const po2Val = extractValue([
      /(?:^|[\s\r\n])[>\)\]\|I!l1\s]*p?[O0o][2zZ]\b[^\d\n\r]{0,15}?(\d{1,3}(?:\.\d)?)/i,
      /\b(?:p[O0o][2zZ]|po2)[^\d\n\r]{0,15}?(\d{1,3}(?:\.\d)?)\b/i,
      /\b(?:pO2|PO2)\b[^\d]{0,20}(\d{1,3}(?:\.\d)?)/i,
    ], 15, 500);
    if (po2Val !== undefined) results.po2 = po2Val;
  }

  // 4. Standard Bicarb HCO3std / SBC
  if (results.hco3std === undefined) {
    const hco3stdVal = extractValue([
      /\b(?:c?H[C\(][O0o]+3[\-_]?(?:\([^)]*st[^)]*\)|std|st)|SBC)[^\d\n\r]{0,15}?(\d{1,2}(?:\.\d)?)\b/i,
      /\b(?:HCO3std|HCO3\(st\)|SBC)[^\d]{0,15}?(\d{1,2}(?:\.\d)?)/i,
    ], 5, 50);
    if (hco3stdVal !== undefined) results.hco3std = hco3stdVal;
  }

  // 5. Actual Bicarbonate HCO3-
  if (results.hco3 === undefined) {
    const hco3Val = extractValue([
      /(?:^|[\s\r\n])(?:c?H[C\(][O0o]+3[\-_]?(?!\w*std)(?:\(P\)|act)?|Bicarb(?:onate)?)[^\d\n\r]{0,15}?(\d{1,2}(?:\.\d)?)/i,
      /\b(?:c?HCO3[\-_]?|HC03[\-_]?)[^\d]{0,15}?(\d{1,2}(?:\.\d)?)/i,
    ], 2, 55);
    if (hco3Val !== undefined) results.hco3 = hco3Val;
  }

  // 6. Sodium Na+
  if (results.na === undefined) {
    const naVal = extractValue([
      /(?:^|[\s\r\n])(?:c?Na[\+\*t]?|Sodium)[^\d\n\r]{0,15}?(\d{2,3}(?:\.\d)?)/i,
      /\b(?:c?Na\+?|Sodium)\s*[:=]?\s*(\d{2,3}(?:\.\d)?)/i,
    ], 100, 190);
    if (naVal !== undefined) results.na = naVal;
  }

  // 7. Potassium K+
  if (results.k === undefined) {
    const kVal = extractValue([
      /(?:^|[\s\r\n])(?:c?K[\+\*t]?|Potassium)[^\d\n\r]{0,15}?([1-9](?:\.\d{1,2})?)/i,
      /\b(?:c?K\+?|Potassium)\s*[:=]?\s*([1-9](?:\.\d{1,2})?)/i,
    ], 1.0, 10.0);
    if (kVal !== undefined) results.k = kVal;
  }

  // 8. Chloride Cl-
  if (results.cl === undefined) {
    const clVal = extractValue([
      /(?:^|[\s\r\n])(?:c?C[lI1][\-_]?|Chloride)[^\d\n\r]{0,15}?(\d{2,3}(?:\.\d)?)/i,
      /\b(?:c?Cl[\-_]?|Chloride)\s*[:=]?\s*(\d{2,3}(?:\.\d)?)/i,
    ], 60, 150);
    if (clVal !== undefined) results.cl = clVal;
  }

  // 9. Calcium Ca++ / iCa
  if (results.ca === undefined) {
    const caVal = extractValue([
      /(?:^|[\s\r\n])(?:c?Ca(?:\+\+|2\+|\+)?|iCa|Calcium)[^\d\n\r]{0,15}?([0-3]\.\d{1,2})/i,
    ], 0.3, 5.0);
    if (caVal !== undefined) results.ca = caVal;
  }

  // 10. Glucose / RBG (includes GEM 3000 "Glu")
  if (results.rbg === undefined) {
    const rbgVal = extractValue([
      /(?:^|[\s\r\n])(?:c?Glu(?:cose)?|RBG|BG)[^\d\n\r]{0,15}?(\d{2,4}(?:\.\d)?)/i,
      /\b(?:cGlu|Glu|Glucose|RBG)\s*[:=]?\s*(\d{2,4})/i,
    ], 20, 1200);
    if (rbgVal !== undefined) results.rbg = rbgVal;
  }

  // 11. Hemoglobin Hb / THbc
  if (results.hb === undefined) {
    const hbVal = extractValue([
      /(?:^|[\s\r\n])(?:THbc|c?t?H[bg]c?|Hgb|Hemoglobin)[^\d\n\r]{0,15}?(\d{1,2}(?:\.\d)?)/i,
      /\b(?:ctHb|tHb|Hb|Hgb|THbc)\s*[:=]?\s*(\d{1,2}(?:\.\d)?)/i,
    ], 3.0, 25.0);
    if (hbVal !== undefined) results.hb = hbVal;
  }

  return results;
}

const PARSED_SLIP_FIELDS = ["ph", "pco2", "po2", "hco3", "hco3std", "na", "k", "cl", "ca", "rbg", "hb"] as const satisfies readonly (keyof ParsedSlip)[];

/**
 * Merges independent OCR passes conservatively. A value may be used when one pass found it or all
 * passes that found it agree; any numerical disagreement leaves the field blank for manual review.
 */
export function parseABGSlipTexts(texts: readonly string[]): ParsedSlip {
  const readings = texts.map((text) => parseABGSlipText(text));
  const result: ParsedSlip = {};
  for (const field of PARSED_SLIP_FIELDS) {
    const values = readings.map((reading) => reading[field]).filter((value): value is number => value !== undefined);
    const [first] = values;
    if (first !== undefined && values.every((value) => value === first)) result[field] = first;
  }
  return result;
}

export const SAMPLE_SLIP_GEM3000_1 = `Instrumentation Laboratory
PATIENT SAMPLE REPORT
Status: ACCEPTED
9/10/2026 16:59:31
Sample Type: Venous
Sample No.: 190
Instrument: Model: GEM 3000
Measured (37.0C)
>H 7.38
>CO2 43 mmHg
>O2 35 mmHg
Na+ 128 mmol/L
K+ 3.4 mmol/L
Ca++ 3.48 mmol/L
Glu 68 mg/dL
Lac 1.2 mmol/L
Hct 57 %

Derived Parameters
Ca++(7.4) 3.45 mmol/L
HCO3- 25.4 mmol/L
HCO3std 23.8 mmol/L
TCO2 26.7 mmol/L
BEecf 0.3 mmol/L
BE(B) -0.0 mmol/L
sO2c 66 %
THbc 17.7 g/dL`;

export const SAMPLE_SLIP_GEM3000_2 = `Model: GEM 3000
Measured (37.0C)
>H 7.25
>CO2 31 mmHg
>O2 30 mmHg
Na+ 129 mmol/L
K+ 3.9 mmol/L
Ca++ 1.89 mmol/L
Glu 383 mg/dL
Lac 0.9 mmol/L
Hct 38 %

Derived Parameters
Ca++(7.4) 1.78 mmol/L
HCO3- 13.6 mmol/L
HCO3std 14.0 mmol/L
TCO2 14.6 mmol/L
BEecf -13.6 mmol/L
BE(B) -12.4 mmol/L
sO2c 45 %
THbc 11.8 g/dL`;

export const SAMPLE_SLIP_DKA = `RADIOMETER ABL800
pH 7.21
pCO2 29.4 mmHg
pO2 88.0 mmHg
cHCO3-(P) 11.2 mmol/L
cHCO3-(P,st) 12.0 mmol/L
cNa+ 136 mmol/L
cK+ 5.1 mmol/L
cCl- 99 mmol/L
cCa2+ 1.16 mmol/L
cGlu 340 mg/dL
ctHb 13.5 g/dL`;

export const SAMPLE_SLIP_RESOLVED = `ROCHE COBAS B 221
pH 7.37
pCO2 35.0 mmHg
pO2 95.0 mmHg
HCO3 20.0 mmol/L
HCO3std 20.5 mmol/L
Na 138 mmol/L
K 4.4 mmol/L
Cl 102 mmol/L
iCa 1.18 mmol/L
Glu 185 mg/dL
Hb 13.2 g/dL`;
