/**
 * Number parser distinguishing missing values from zero or invalid numbers.
 * Ported unchanged from parseMeasurement in the prototype.
 */
export function parseMeasurement(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return !isNaN(n) && isFinite(n) ? n : null;
}
