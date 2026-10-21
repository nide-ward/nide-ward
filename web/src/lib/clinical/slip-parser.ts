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

/**
 * Port of parseABGSlipText. The regular expressions are copied verbatim; only types were added.
 * Used for text pasted from (or OCR'd off) a blood gas analyser slip.
 */
export function parseABGSlipText(text: string | null | undefined): ParsedSlip {
  if (!text) return {};
  const clean = text.replace(/,/g, ".");
  const results: ParsedSlip = {};

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

  // 1. pH (Range: 6.5 - 7.9)
  const phVal = extractValue([
    /\b(?:p[Hh]|PH)\s*[:=]?\s*([67]\.\d{1,3})\b/i,
    /\b(?:p[Hh]|PH)[^\d\n\r]{0,12}([67]\.\d{1,3})\b/i,
    /\b([67]\.\d{2,3})\b/,
  ], 6.5, 7.9);
  if (phVal !== undefined) results.ph = phVal;

  // 2. pCO2 (Range: 10 - 150)
  const pco2Val = extractValue([
    /\b(?:p[Cck][O0o][2zZ]|pco2)[^\d\n\r]{0,15}?(\d{1,3}(?:\.\d)?)\b/i,
    /(?:pCO2|pC02|pco2)\s*[:=]?\s*(\d{1,3}(?:\.\d)?)/i,
    /\b(?:pCO2|PCO2)\b[^\d]{0,20}(\d{1,3}(?:\.\d)?)/i,
  ], 10, 150);
  if (pco2Val !== undefined) results.pco2 = pco2Val;

  // 3. pO2 (Range: 15 - 500)
  const po2Val = extractValue([
    /\b(?:p[O0o][2zZ]|po2)[^\d\n\r]{0,15}?(\d{1,3}(?:\.\d)?)\b/i,
    /(?:pO2|p02|po2)\s*[:=]?\s*(\d{1,3}(?:\.\d)?)/i,
    /\b(?:pO2|PO2)\b[^\d]{0,20}(\d{1,3}(?:\.\d)?)/i,
  ], 15, 500);
  if (po2Val !== undefined) results.po2 = po2Val;

  // 4. Standard Bicarb SBC / HCO3(st) (Range: 5 - 50)
  const hco3stdVal = extractValue([
    /\b(?:c?H[C\(][O0o]3?[\-_]?(?:\([^)]*st[^)]*\)|std|st)|SBC)[^\d\n\r]{0,15}?(\d{1,2}(?:\.\d)?)\b/i,
    /\b(?:HCO3std|HCO3\(st\)|SBC)[^\d]{0,15}?(\d{1,2}(?:\.\d)?)/i,
  ], 5, 50);
  if (hco3stdVal !== undefined) results.hco3std = hco3stdVal;

  // 5. Actual Bicarbonate HCO3 / cHCO3-(P) (Range: 2 - 55)
  const hco3Val = extractValue([
    /\b(?:c?H[C\(][O0o]3?[\-_]?(?:\(P\)|act)?|Bicarb(?:onate)?)[^\d\n\r]{0,15}?(\d{1,2}(?:\.\d)?)\b/i,
    /\b(?:c?HCO3|HC03|HCO3-)[^\d]{0,15}?(\d{1,2}(?:\.\d)?)/i,
    /(?:HCO3|HC03)\s*[:=]?\s*(\d{1,2}(?:\.\d)?)/i,
  ], 2, 55);
  if (hco3Val !== undefined) results.hco3 = hco3Val;

  // 6. Sodium Na / cNa+ (Range: 100 - 190)
  const naVal = extractValue([
    /\b(?:c?Na[\+\*t]?|Sodium)[^\d\n\r]{0,15}?(\d{2,3}(?:\.\d)?)\b/i,
    /\b(?:c?Na\+?|Sodium)\s*[:=]?\s*(\d{2,3}(?:\.\d)?)/i,
  ], 100, 190);
  if (naVal !== undefined) results.na = naVal;

  // 7. Potassium K / cK+ (Range: 1.0 - 10.0)
  const kVal = extractValue([
    /\b(?:c?K[\+\*t]?|Potassium)[^\d\n\r]{0,15}?([1-9](?:\.\d{1,2})?)\b/i,
    /\b(?:c?K\+?|Potassium)\s*[:=]?\s*([1-9](?:\.\d{1,2})?)/i,
  ], 1.0, 10.0);
  if (kVal !== undefined) results.k = kVal;

  // 8. Chloride Cl / cCl- (Range: 60 - 150)
  const clVal = extractValue([
    /\b(?:c?C[lI1][\-_]?|Chloride)[^\d\n\r]{0,15}?(\d{2,3}(?:\.\d)?)\b/i,
    /\b(?:c?Cl[\-_]?|Chloride)\s*[:=]?\s*(\d{2,3}(?:\.\d)?)/i,
  ], 60, 150);
  if (clVal !== undefined) results.cl = clVal;

  // 9. Calcium Ca / cCa2+ / iCa (Range: 0.3 - 3.5)
  const caVal = extractValue([
    /\b(?:c?Ca(?:2\+|\+{1,2}|t)?|iCa|Calcium)[^\d\n\r]{0,15}?([0-3]\.\d{1,2})\b/i,
    /\b(?:c?Ca|iCa)\s*[:=]?\s*([0-3]\.\d{1,2})/i,
  ], 0.3, 3.5);
  if (caVal !== undefined) results.ca = caVal;

  // 10. Glucose / RBG (Range: 20 - 1200)
  const rbgVal = extractValue([
    /\b(?:c?Glu(?:cose)?|RBG|BG)[^\d\n\r]{0,15}?(\d{2,4}(?:\.\d)?)\b/i,
    /\b(?:cGlu|Glu|Glucose|RBG)\s*[:=]?\s*(\d{2,4})/i,
  ], 20, 1200);
  if (rbgVal !== undefined) results.rbg = rbgVal;

  // 11. Hemoglobin Hb / ctHb (Range: 3.0 - 25.0)
  const hbVal = extractValue([
    /\b(?:c?t?H[bg]|Hgb|Hemoglobin)[^\d\n\r]{0,15}?(\d{1,2}(?:\.\d)?)\b/i,
    /\b(?:ctHb|tHb|Hb|Hgb)\s*[:=]?\s*(\d{1,2}(?:\.\d)?)/i,
  ], 3.0, 25.0);
  if (hbVal !== undefined) results.hb = hbVal;

  return results;
}

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
