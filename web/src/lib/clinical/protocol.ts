import { parseMeasurement } from "./numbers";
import type { AbgAnalysis, AbgEntry } from "./abg";

export type FluidState = "stop" | "continue";
export interface FluidGuidance {
  state: FluidState;
  text: string;
}

/**
 * Port of the fluid half of updateProtocolGuidance.
 * Stop IV fluids when urine acetone is Negative AND the latest K+ is measured and >= 4.0.
 */
export function fluidGuidance(acetone: string, latest: AbgEntry | null | undefined): FluidGuidance {
  const kVal = latest ? parseMeasurement(latest.k) : null;
  const isAcetoneNil = acetone === "Negative";
  const isKStable = kVal !== null && kVal >= 4.0;

  if (isAcetoneNil && isKStable) {
    return { state: "stop", text: "Fluid Protocol: STOP IV Fluids (Acetone is Nil & K+ ≥ 4.0 mEq/L)" };
  }
  const kDisplay = kVal !== null ? `${kVal} mEq/L` : "Unmeasured";
  return { state: "continue", text: `Fluid Protocol: Continue IV Hydration (Acetone: ${acetone}, K+: ${kDisplay})` };
}

export type InsulinState = "shift" | "halted" | "maintain" | "awaiting";
export interface InsulinGuidance {
  state: InsulinState;
  text: string;
}

/** Port of the insulin half of updateProtocolGuidance. */
export function insulinGuidance(analysis: AbgAnalysis | null): InsulinGuidance {
  if (analysis && analysis.isShiftReady) {
    return {
      state: "shift",
      text: `Insulin Shift: Safe to Shift to SubQ Basal-Bolus (pH ${analysis.ph} ≥ 7.35 confirmed)`,
    };
  }
  if (analysis && analysis.ph !== null && analysis.ph >= 7.35 && !analysis.isTrusted) {
    return {
      state: "halted",
      text: "Insulin Shift Halted: pH ≥ 7.35 but ABG panel is incomplete or inconsistent. Maintain IM insulin!",
    };
  }
  if (analysis && analysis.ph !== null) {
    return { state: "maintain", text: `Insulin Protocol: Maintain Q2H IM Insulin (pH ${analysis.ph} < 7.35)` };
  }
  return { state: "awaiting", text: "Insulin Protocol: Awaiting ABG to evaluate pH" };
}

/** The closing line of the AI ABG reader (updateAIABGReader), as plain text. */
export function shiftSummaryLine(res: AbgAnalysis): { ready: boolean; text: string } {
  if (res.isShiftReady) {
    return {
      ready: true,
      text: "✓ Verified pH ≥ 7.35: Patient meets criteria to discontinue Q2H IM regular insulin and transition to subcutaneous basal-bolus regimen.",
    };
  }
  if (res.ph !== null && res.ph >= 7.35 && !res.isTrusted) {
    return {
      ready: false,
      text: "⚡ pH is ≥ 7.35 but clinical calculation is untrusted/incomplete. DO NOT shift insulin until repeat ABG confirms resolution.",
    };
  }
  return { ready: false, text: "⚡ pH is below 7.35: Continue Q2H intramuscular insulin protocol until acidosis resolves." };
}

/** Collects the warnings the prototype shows in the amber box, in the same order. */
export function abgWarnings(res: AbgAnalysis): string[] {
  const warnings: string[] = [];
  if (res.trustWarning) warnings.push(res.trustWarning);
  if (res.agWarning) warnings.push(res.agWarning);
  if (res.compensationWarning) warnings.push(res.compensationWarning);
  return warnings;
}
