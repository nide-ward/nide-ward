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

  const phMatch =
    clean.match(/\b(?:p[Hh]|PH)\s*[:=]?\s*([67]\.\d{1,3})\b/) || clean.match(/\b([67]\.\d{2,3})\b/);
  if (phMatch) results.ph = parseFloat(phMatch[1]);

  const pco2Match = clean.match(/\b(?:pCO2|PCO2|pco2)\s*[:=]?\s*(\d{1,3}(?:\.\d)?)\b/i);
  if (pco2Match) results.pco2 = parseFloat(pco2Match[1]);

  const po2Match = clean.match(/\b(?:pO2|PO2|po2)\s*[:=]?\s*(\d{1,3}(?:\.\d)?)\b/i);
  if (po2Match) results.po2 = parseFloat(po2Match[1]);

  const hco3stdMatch = clean.match(
    /\b(?:c?HCO3[-_]?(?:\([^)]*st[^)]*\)|std|st)|SBC)\s*[:=]?\s*(\d{1,2}(?:\.\d)?)\b/i,
  );
  if (hco3stdMatch) results.hco3std = parseFloat(hco3stdMatch[1]);

  const hco3Match = clean.match(/\b(?:c?HCO3[-_]?(?:\(P\))?|Act\s*HCO3|Bicarb)\s*[:=]?\s*(\d{1,2}(?:\.\d)?)\b/i);
  if (hco3Match) results.hco3 = parseFloat(hco3Match[1]);

  const naMatch = clean.match(/\b(?:c?Na\+?|Sodium)\s*[:=]?\s*(\d{2,3}(?:\.\d)?)\b/i);
  if (naMatch) results.na = parseFloat(naMatch[1]);

  const kMatch = clean.match(/\b(?:c?K\+?|Potassium)\s*[:=]?\s*([1-9](?:\.\d{1,2})?)\b/i);
  if (kMatch) results.k = parseFloat(kMatch[1]);

  const clMatch = clean.match(/\b(?:c?Cl[-_]?|Chloride)\s*[:=]?\s*(\d{2,3}(?:\.\d)?)\b/i);
  if (clMatch) results.cl = parseFloat(clMatch[1]);

  const caMatch = clean.match(/\b(?:c?Ca(?:\+{1,2}|2\+)?|iCa|Calcium)\s*[:=]?\s*([0-2]\.\d{1,2})\b/i);
  if (caMatch) results.ca = parseFloat(caMatch[1]);

  const rbgMatch = clean.match(/\b(?:c?Glu(?:cose)?|RBG|BG)\s*[:=]?\s*(\d{2,4})\b/i);
  if (rbgMatch) results.rbg = parseFloat(rbgMatch[1]);

  const hbMatch = clean.match(/\b(?:c?t?Hb|Hgb|Hemoglobin)\s*[:=]?\s*(\d{1,2}(?:\.\d)?)\b/i);
  if (hbMatch) results.hb = parseFloat(hbMatch[1]);

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
