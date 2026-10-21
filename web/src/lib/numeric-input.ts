/**
 * Normalises what phones in Egypt type into number fields, before it is parsed:
 *  - Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits become 0-9
 *  - the Arabic decimal separator (٫) and a comma become "."  ("7,21" is pH 7.21)
 *  - the Arabic thousands separator (٬) and spaces are dropped
 * Clinical fields here never need thousands separators, so a comma is always a decimal point.
 * Fields show the normalised text as it is typed, so the user sees "7.21", not a silent reinterpretation.
 */
export function normalizeNumericText(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, ".")
    .replace(/[٬\s]/g, "");
}
