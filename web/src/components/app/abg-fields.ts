import type { ParsedSlip } from "@/lib/clinical";

export type FieldKey = "ph" | "pco2" | "po2" | "hco3" | "hco3Std" | "na" | "k" | "cl" | "ca" | "rbg" | "hb";
export const FIELDS: { key: FieldKey; label: string; placeholder: string }[] = [
  { key: "ph", label: "pH", placeholder: "7.35" },
  { key: "pco2", label: "pCO2 (mmHg)", placeholder: "40.0" },
  { key: "po2", label: "pO2 (mmHg)", placeholder: "85.0" },
  { key: "hco3", label: "HCO3 (mmol/L)", placeholder: "24.0" },
  { key: "hco3Std", label: "Standard HCO3", placeholder: "23.5" },
  { key: "na", label: "Na (mmol/L)", placeholder: "138" },
  { key: "k", label: "K (mmol/L)", placeholder: "4.5" },
  { key: "cl", label: "Cl (mmol/L)", placeholder: "100" },
  { key: "ca", label: "Ionised Ca", placeholder: "1.18" },
  { key: "rbg", label: "RBG (mg/dL)", placeholder: "280" },
  { key: "hb", label: "Hb (g/dL)", placeholder: "13.2" },
];
export const EMPTY: Record<FieldKey, string> = Object.fromEntries(FIELDS.map((f) => [f.key, ""])) as Record<FieldKey, string>;

/** Parsed slip values as form field text. The parser calls standard bicarbonate `hco3std`; the form calls it `hco3Std`. */
export function slipToFields(parsed: ParsedSlip): Partial<Record<FieldKey, string>> {
  const out: Partial<Record<FieldKey, string>> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (v === undefined) continue;
    out[(k === "hco3std" ? "hco3Std" : k) as FieldKey] = String(v);
  }
  return out;
}
