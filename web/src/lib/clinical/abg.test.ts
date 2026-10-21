import { describe, expect, it } from "vitest";
import { analyzeABG } from "./abg";
import { parseMeasurement } from "./numbers";

describe("parseMeasurement", () => {
  it("separates missing from zero and invalid", () => {
    expect(parseMeasurement(null)).toBeNull();
    expect(parseMeasurement(undefined)).toBeNull();
    expect(parseMeasurement("")).toBeNull();
    expect(parseMeasurement("abc")).toBeNull();
    expect(parseMeasurement(Infinity)).toBeNull();
    expect(parseMeasurement(0)).toBe(0);
    expect(parseMeasurement("7.35")).toBe(7.35);
  });
});

describe("analyzeABG", () => {
  it("returns null when pH, pCO2 and HCO3 are all missing, or no entry", () => {
    expect(analyzeABG(null)).toBeNull();
    expect(analyzeABG(undefined)).toBeNull();
    expect(analyzeABG({ na: 140, cl: 100, k: 4 })).toBeNull();
  });

  it("interprets the prototype's admission DKA gas (F1, pH 7.24) as HAGMA", () => {
    const r = analyzeABG({ ph: 7.24, pco2: 28, hco3: 11.5, na: 134, cl: 98, k: 5.2 })!;
    expect(r.ag).toBe(24.5);
    expect(r.isHighAG).toBe(true);
    expect(r.agStatusText).toBe("24.5 mmol/L (High AG > 12)");
    expect(r.wintersMin).toBe(23.3);
    expect(r.wintersMax).toBe(27.3);
    expect(r.respiratoryComp).toBe("Concurrent Respiratory Acidosis (measured pCO2 28 > Winter's target 23.3-27.3)");
    expect(r.deltaRatio).toBe(1);
    expect(r.deltaRatioText).toBe("Delta Ratio 1: Pure High Anion Gap Acidosis (typical uncomplicated DKA)");
    expect(r.diagnosis).toBe("High Anion Gap Metabolic Acidosis (HAGMA)");
    expect(r.isTrusted).toBe(true);
    expect(r.isShiftReady).toBe(false);
  });

  it("recognises a resolved DKA gas (F1, pH 7.37) as shift-ready", () => {
    const r = analyzeABG({ ph: 7.37, pco2: 35, hco3: 20, na: 137, cl: 102, k: 4.4 })!;
    expect(r.ag).toBe(15);
    expect(r.isHighAG).toBe(true);
    expect(r.diagnosis).toBe("Compensated High Anion Gap Metabolic Acidosis");
    expect(r.isTrusted).toBe(true);
    expect(r.isShiftReady).toBe(true);
  });

  it("never assumes electrolytes: AG is null and a warning is given", () => {
    const r = analyzeABG({ ph: 7.3, pco2: 30, hco3: 14 })!;
    expect(r.ag).toBeNull();
    expect(r.agStatusText).toBe("Unmeasured (Missing Na+, Cl-)");
    expect(r.agWarning).toBe(
      "Anion Gap cannot be calculated: Missing measured electrolytes (Na+, Cl-). Normal values were NOT assumed.",
    );
    expect(r.deltaRatioText).toBe("Delta ratio unavailable (Anion Gap unmeasured)");
    expect(r.diagnosis).toBe("Metabolic Acidosis (Anion Gap unmeasured)");
  });

  it("flags a pH that contradicts Henderson-Hasselbalch and blocks the insulin shift", () => {
    // pCO2 40 / HCO3 24 gives pH ~7.40, so a reported 7.10 is inconsistent.
    const r = analyzeABG({ ph: 7.1, pco2: 40, hco3: 24, na: 140, cl: 104 })!;
    expect(r.isTrusted).toBe(false);
    expect(r.trustWarning).toContain("Internal Inconsistency Detected");
    expect(r.trustWarning).toContain("expected pH ~7.4");
    const r2 = analyzeABG({ ph: 7.4, pco2: 40, hco3: 40, na: 140, cl: 100 })!;
    expect(r2.isTrusted).toBe(false);
    expect(r2.isShiftReady).toBe(false);
  });

  it("marks an incomplete panel untrusted even at normal pH", () => {
    const r = analyzeABG({ ph: 7.4 })!;
    expect(r.isTrusted).toBe(false);
    expect(r.isShiftReady).toBe(false);
    expect(r.trustWarning).toBe(
      "⚠️ Incomplete Blood Gas Panel: Missing pCO2 and HCO3-. Calculations are provisional and cannot be trusted for protocol transitions.",
    );
    expect(r.diagnosis).toBe("Normal pH / Compensated Acid-Base State");
  });

  it("handles missing pH", () => {
    const r = analyzeABG({ pco2: 40, hco3: 24 })!;
    expect(r.diagnosis).toBe("pH Unmeasured: Acid-base state unknown");
    expect(r.trustWarning).toBe("⚠️ Missing pH measurement: Blood gas calculation cannot be completed.");
    expect(r.isShiftReady).toBe(false);
  });

  it("classifies the prototype's COPD gas (M1) as primary respiratory acidosis", () => {
    const r = analyzeABG({ ph: 7.28, pco2: 62, hco3: 28.5, na: 139, cl: 101 })!;
    expect(r.diagnosis).toBe("Primary Respiratory Acidosis");
    expect(r.respiratoryComp).toBe("Normal or elevated bicarbonate level (Winter's formula not indicated)");
    expect(r.deltaRatio).toBeNull();
    expect(r.isTrusted).toBe(true);
    expect(r.isShiftReady).toBe(false);
  });

  it("classifies alkalosis", () => {
    expect(analyzeABG({ ph: 7.55, pco2: 40, hco3: 34 })!.diagnosis).toBe("Primary Metabolic Alkalosis");
    expect(analyzeABG({ ph: 7.55, pco2: 25, hco3: 22 })!.diagnosis).toBe("Primary Respiratory Alkalosis");
  });

  it("warns on an unusually low anion gap", () => {
    const r = analyzeABG({ ph: 7.4, pco2: 40, hco3: 25, na: 128, cl: 102 })!;
    expect(r.ag).toBe(1);
    expect(r.agWarning).toContain("Unusually Low Anion Gap (1 mmol/L)");
  });

  it("selects delta ratio bands", () => {
    // delta ratio = (AG-12)/(24-HCO3)
    expect(analyzeABG({ ph: 7.2, pco2: 25, hco3: 10, na: 140, cl: 113 })!.deltaRatioText).toContain("Predominantly Normal Anion Gap");
    expect(analyzeABG({ ph: 7.2, pco2: 25, hco3: 10, na: 140, cl: 109 })!.deltaRatioText).toContain("Combined High AG & Normal AG");
    expect(analyzeABG({ ph: 7.2, pco2: 25, hco3: 10, na: 140, cl: 100 })!.deltaRatioText).toContain("Pure High Anion Gap");
    expect(analyzeABG({ ph: 7.2, pco2: 40, hco3: 20, na: 150, cl: 108 })!.deltaRatioText).toContain("Metabolic Alkalosis");
  });
});
