import { describe, expect, it } from "vitest";
import { analyzeABG } from "./abg";
import { abgWarnings, fluidGuidance, insulinGuidance, shiftSummaryLine } from "./protocol";

const dka = { ph: 7.24, pco2: 28, hco3: 11.5, na: 134, cl: 98, k: 5.2 };
const resolved = { ph: 7.37, pco2: 35, hco3: 20, na: 137, cl: 102, k: 4.4 };

describe("fluidGuidance", () => {
  it("stops IV fluids only when acetone is Negative and K+ >= 4.0", () => {
    expect(fluidGuidance("Negative", resolved)).toEqual({
      state: "stop",
      text: "Fluid Protocol: STOP IV Fluids (Acetone is Nil & K+ ≥ 4.0 mEq/L)",
    });
    expect(fluidGuidance("Negative", { k: 4.0 }).state).toBe("stop");
  });
  it("continues hydration for positive acetone, low or unmeasured K+", () => {
    expect(fluidGuidance("++", resolved).text).toBe("Fluid Protocol: Continue IV Hydration (Acetone: ++, K+: 4.4 mEq/L)");
    expect(fluidGuidance("Negative", { k: 3.9 }).state).toBe("continue");
    expect(fluidGuidance("Negative", null).text).toBe("Fluid Protocol: Continue IV Hydration (Acetone: Negative, K+: Unmeasured)");
  });
});

describe("insulinGuidance", () => {
  it("shifts to SubQ only when pH >= 7.35 and the panel is trusted", () => {
    expect(insulinGuidance(analyzeABG(resolved))).toEqual({
      state: "shift",
      text: "Insulin Shift: Safe to Shift to SubQ Basal-Bolus (pH 7.37 ≥ 7.35 confirmed)",
    });
  });
  it("halts the shift when pH >= 7.35 but the panel is untrusted", () => {
    expect(insulinGuidance(analyzeABG({ ph: 7.4 })).state).toBe("halted");
  });
  it("maintains IM insulin in acidosis", () => {
    expect(insulinGuidance(analyzeABG(dka))).toEqual({
      state: "maintain",
      text: "Insulin Protocol: Maintain Q2H IM Insulin (pH 7.24 < 7.35)",
    });
  });
  it("waits for an ABG when there is none", () => {
    expect(insulinGuidance(null)).toEqual({ state: "awaiting", text: "Insulin Protocol: Awaiting ABG to evaluate pH" });
  });
});

describe("reader summary", () => {
  it("returns the closing line per state", () => {
    expect(shiftSummaryLine(analyzeABG(resolved)!).ready).toBe(true);
    expect(shiftSummaryLine(analyzeABG(dka)!).text).toContain("pH is below 7.35");
    expect(shiftSummaryLine(analyzeABG({ ph: 7.4 })!).text).toContain("untrusted/incomplete");
  });
  it("orders warnings trust, AG, compensation", () => {
    const w = abgWarnings(analyzeABG({ ph: 7.4 })!);
    expect(w[0]).toContain("Incomplete Blood Gas Panel");
    expect(w[1]).toContain("Anion Gap cannot be calculated");
    expect(w[2]).toContain("Winter's formula cannot be evaluated");
  });
});
