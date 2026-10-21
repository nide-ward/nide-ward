/**
 * Every admit field is optional, so names, ages and diagnoses can be blank. These helpers keep the
 * wording identical on the board, chart, archive, print sheets and toasts. Server-safe (no "use client").
 */
export const NO_DIAGNOSIS = "No diagnosis recorded";

/** "Unnamed patient", or "Unnamed patient (Bed F-1)" where the bed is not otherwise visible. */
export function patientLabel(name: string | null | undefined, bedName?: string): string {
  const n = (name ?? "").trim();
  if (n) return n;
  return bedName ? `Unnamed patient (${bedName})` : "Unnamed patient";
}

export const isBlank = (v: string | null | undefined): boolean => !v || !v.trim();

/** "58 years", or an empty string when the age was not entered. */
export function ageText(age: number | null | undefined): string {
  return age === null || age === undefined ? "" : `${age} ${age === 1 ? "year" : "years"}`;
}

/** Short form for tables and print: "58y" or "". */
export function ageShort(age: number | null | undefined): string {
  return age === null || age === undefined ? "" : `${age}y`;
}

/** Reads the age text field: blank is allowed (null); otherwise whole years from 0 to 130. */
export function parseAgeInput(text: string): { value: number | null; valid: boolean } {
  const t = text.trim();
  if (t === "") return { value: null, valid: true };
  if (!/^\d{1,3}$/.test(t)) return { value: null, valid: false };
  const n = Number(t);
  return n <= 130 ? { value: n, valid: true } : { value: null, valid: false };
}
export const AGE_ERROR = "Age must be a whole number of years from 0 to 130, or left blank.";
