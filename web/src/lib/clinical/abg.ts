import { parseMeasurement } from "./numbers";

/** The measured fields of one blood gas. Any of them may be missing. */
export interface AbgEntry {
  ph?: number | null;
  pco2?: number | null;
  po2?: number | null;
  hco3?: number | null;
  na?: number | null;
  k?: number | null;
  cl?: number | null;
  ca?: number | null;
  rbg?: number | null;
  hb?: number | null;
}

export interface AbgAnalysis {
  ph: number | null;
  pco2: number | null;
  hco3: number | null;
  na: number | null;
  cl: number | null;
  k: number | null;
  missingInputs: string[];
  ag: number | null;
  isHighAG: boolean;
  agStatusText: string;
  agWarning: string | null;
  wintersExpected: number | null;
  wintersMin: number | null;
  wintersMax: number | null;
  respiratoryComp: string;
  compensationWarning: string | null;
  deltaRatio: number | null;
  deltaRatioText: string;
  diagnosis: string;
  isTrusted: boolean;
  trustWarning: string | null;
  isShiftReady: boolean;
}

/**
 * Hardened clinical ABG interpreter. Port of analyzeABG in the prototype; the logic,
 * thresholds and wording are intentionally unchanged.
 *
 * - Distinguishes missing measurements from real numbers.
 * - Calculates anion gap only when Na+, Cl- and HCO3- are all measured.
 * - Flags incomplete panels and Henderson-Hasselbalch inconsistencies.
 */
export function analyzeABG(entry: AbgEntry | null | undefined): AbgAnalysis | null {
  if (!entry) return null;

  const ph = parseMeasurement(entry.ph);
  const pco2 = parseMeasurement(entry.pco2);
  const hco3 = parseMeasurement(entry.hco3);
  const na = parseMeasurement(entry.na);
  const cl = parseMeasurement(entry.cl);
  const k = parseMeasurement(entry.k);

  if (ph === null && pco2 === null && hco3 === null) return null;

  const missingInputs: string[] = [];
  if (ph === null) missingInputs.push("pH");
  if (pco2 === null) missingInputs.push("pCO2");
  if (hco3 === null) missingInputs.push("HCO3-");
  if (na === null) missingInputs.push("Na+");
  if (cl === null) missingInputs.push("Cl-");

  // 1. Anion gap (only when Na+, Cl- and HCO3- are strictly present)
  let ag: number | null = null;
  let isHighAG = false;
  let agStatusText = "";
  let agWarning: string | null = null;

  if (na !== null && cl !== null && hco3 !== null) {
    ag = parseFloat((na - (cl + hco3)).toFixed(1));
    isHighAG = ag > 12;
    agStatusText = `${ag} mmol/L (${isHighAG ? "High AG > 12" : "Normal AG ≤ 12"})`;

    if (ag < 3) {
      agWarning = `⚠️ Unusually Low Anion Gap (${ag} mmol/L): Verify laboratory quality or evaluate for severe hypoalbuminemia, hypercalcemia, lithium toxicity, or bromide interference.`;
    }
  } else {
    const missingAGInputs: string[] = [];
    if (na === null) missingAGInputs.push("Na+");
    if (cl === null) missingAGInputs.push("Cl-");
    if (hco3 === null) missingAGInputs.push("HCO3-");
    agStatusText = `Unmeasured (Missing ${missingAGInputs.join(", ")})`;
    agWarning = `Anion Gap cannot be calculated: Missing measured electrolytes (${missingAGInputs.join(", ")}). Normal values were NOT assumed.`;
  }

  // 2. Winter's formula for respiratory compensation (expected pCO2 = 1.5 * HCO3 + 8 ± 2)
  let wintersExpected: number | null = null;
  let wintersMin: number | null = null;
  let wintersMax: number | null = null;
  let respiratoryComp = "";
  let compensationWarning: string | null = null;

  if (hco3 !== null) {
    wintersExpected = 1.5 * hco3 + 8;
    wintersMin = parseFloat((wintersExpected - 2).toFixed(1));
    wintersMax = parseFloat((wintersExpected + 2).toFixed(1));

    if (hco3 < 22) {
      if (pco2 !== null) {
        if (pco2 > wintersMax) {
          respiratoryComp = `Concurrent Respiratory Acidosis (measured pCO2 ${pco2} > Winter's target ${wintersMin}-${wintersMax})`;
        } else if (pco2 < wintersMin) {
          respiratoryComp = `Concurrent Respiratory Alkalosis / Hyperventilation (measured pCO2 ${pco2} < Winter's target ${wintersMin}-${wintersMax})`;
        } else {
          respiratoryComp = `Adequate Respiratory Compensation (Winter's target ${wintersMin}–${wintersMax} mmHg)`;
        }
      } else {
        respiratoryComp = `Winter's Target: ${wintersMin}–${wintersMax} mmHg (Measured pCO2 missing — compensation unconfirmed)`;
        compensationWarning = "Respiratory compensation cannot be confirmed: pCO2 was not measured.";
      }
    } else {
      respiratoryComp = "Normal or elevated bicarbonate level (Winter's formula not indicated)";
    }
  } else {
    respiratoryComp = "Incomplete: HCO3- is unmeasured";
    compensationWarning = "Winter's formula cannot be evaluated without measured HCO3-.";
  }

  // 3. Delta ratio (only if high-AG acidosis is present with complete inputs)
  let deltaRatio: number | null = null;
  let deltaRatioText = "";
  if (ag !== null && isHighAG && hco3 !== null && hco3 < 24) {
    const deltaAG = ag - 12;
    const deltaHCO3 = 24 - hco3;
    if (deltaHCO3 > 0) {
      deltaRatio = parseFloat((deltaAG / deltaHCO3).toFixed(2));
      if (deltaRatio < 0.4) {
        deltaRatioText = `Delta Ratio ${deltaRatio}: Predominantly Normal Anion Gap (Hyperchloremic) Acidosis`;
      } else if (deltaRatio >= 0.4 && deltaRatio < 0.8) {
        deltaRatioText = `Delta Ratio ${deltaRatio}: Combined High AG & Normal AG Acidosis (e.g. DKA + saline dilution)`;
      } else if (deltaRatio >= 0.8 && deltaRatio <= 2.0) {
        deltaRatioText = `Delta Ratio ${deltaRatio}: Pure High Anion Gap Acidosis (typical uncomplicated DKA)`;
      } else {
        deltaRatioText = `Delta Ratio ${deltaRatio}: High AG Acidosis with concurrent Metabolic Alkalosis (e.g. vomiting)`;
      }
    }
  } else if (ag === null) {
    deltaRatioText = "Delta ratio unavailable (Anion Gap unmeasured)";
  }

  // 4. Classification and internal consistency (Henderson-Hasselbalch)
  let diagnosis = "";
  let isTrusted = true;
  let trustWarning: string | null = null;

  if (ph !== null) {
    if (ph < 7.35) {
      if (hco3 !== null && hco3 < 22) {
        diagnosis =
          ag !== null
            ? isHighAG
              ? "High Anion Gap Metabolic Acidosis (HAGMA)"
              : "Normal Anion Gap Metabolic Acidosis (NAGMA)"
            : "Metabolic Acidosis (Anion Gap unmeasured)";
      } else if (pco2 !== null && pco2 > 45) {
        diagnosis = "Primary Respiratory Acidosis";
      } else {
        diagnosis = "Acidemia (Provisional: incomplete buffer panel)";
      }
    } else if (ph > 7.45) {
      if (hco3 !== null && hco3 > 26) {
        diagnosis = "Primary Metabolic Alkalosis";
      } else if (pco2 !== null && pco2 < 35) {
        diagnosis = "Primary Respiratory Alkalosis";
      } else {
        diagnosis = "Alkalemia (Provisional: incomplete buffer panel)";
      }
    } else {
      if (hco3 !== null && hco3 < 22 && isHighAG) {
        diagnosis = "Compensated High Anion Gap Metabolic Acidosis";
      } else {
        diagnosis = "Normal pH / Compensated Acid-Base State";
      }
    }
  } else {
    diagnosis = "pH Unmeasured: Acid-base state unknown";
    isTrusted = false;
    trustWarning = "⚠️ Missing pH measurement: Blood gas calculation cannot be completed.";
  }

  if (ph !== null && pco2 !== null && hco3 !== null && hco3 > 0) {
    const expectedH = (24 * pco2) / hco3;
    // pH = 9 - log10([H+] in nmol/L)
    const expectedPH = parseFloat((9 - Math.log10(expectedH)).toFixed(2));
    const phDiff = Math.abs(ph - expectedPH);

    if (phDiff > 0.09) {
      isTrusted = false;
      trustWarning = `⚠️ Internal Inconsistency Detected: Measured pH (${ph}) conflicts with pCO2 (${pco2}) and HCO3 (${hco3}) under the Henderson-Hasselbalch equation (expected pH ~${expectedPH}). The blood gas sample may be venous, clotted, air-exposed, or from an uncalibrated cartridge. DO NOT base critical therapy changes on this reading without repeat verification.`;
    }
  } else if (ph !== null && (pco2 === null || hco3 === null)) {
    isTrusted = false;
    trustWarning = `⚠️ Incomplete Blood Gas Panel: Missing ${missingInputs.filter((m) => m !== "Na+" && m !== "Cl-").join(" and ")}. Calculations are provisional and cannot be trusted for protocol transitions.`;
  }

  // Ward protocol: shift from Q2H IM insulin to SubQ basal-bolus ONLY when pH >= 7.35 AND the panel is trusted.
  const isShiftReady = isTrusted && ph !== null && ph >= 7.35;

  return {
    ph,
    pco2,
    hco3,
    na,
    cl,
    k,
    missingInputs,
    ag,
    isHighAG,
    agStatusText,
    agWarning,
    wintersExpected,
    wintersMin,
    wintersMax,
    respiratoryComp,
    compensationWarning,
    deltaRatio,
    deltaRatioText,
    diagnosis,
    isTrusted,
    trustWarning,
    isShiftReady,
  };
}
