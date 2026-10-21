import { z } from "zod";
import { CLINICAL_ROLES } from "./permissions";
import { THEMES } from "./theme";
import { normalizeUsername, USERNAME_MAX, USERNAME_MIN, USERNAME_PATTERN } from "./username";

/**
 * Shared zod schemas. The server actions re-validate everything; the same schemas are used by
 * the client forms for quick feedback. Ranges are sanity guards against typos, not clinical limits.
 */
const text = (max: number) => z.string().trim().max(max);
const reqText = (max: number, what: string) => z.string().trim().min(1, `${what} is required`).max(max);
const num = (min: number, max: number) => z.number().finite().min(min).max(max);
/** A measurement that may be left blank. */
const opt = (min: number, max: number) => num(min, max).nullable();

export const URINE_ACETONE = ["Negative", "Trace", "+", "++", "+++", "++++"] as const;
export const urineAcetoneSchema = z.enum(URINE_ACETONE);

export const DISCHARGE_OUTCOMES = [
  "DKA Resolved / Discharged Home on SubQ Regimen",
  "Acidosis Resolved / Transferred to General Ward",
  "Transferred to ICU / Critical Care",
  "Discharged on Medical Advice (DAMA)",
  "Transferred to Outside Facility",
] as const;

const isoDate = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

const abgMeasures = {
  takenAt: isoDate,
  ph: num(6.5, 8.0),
  pco2: opt(0, 200),
  po2: opt(0, 700),
  hco3: opt(0, 60),
  hco3Std: opt(0, 60),
  na: opt(80, 200),
  k: opt(0.5, 12),
  cl: opt(50, 160),
  ca: opt(0, 5),
  rbg: opt(0, 2000),
  hb: opt(0, 25),
};

const insulinDoses = {
  basalUnits: num(0, 500),
  breakfastUnits: num(0, 500),
  lunchUnits: num(0, 500),
  dinnerUnits: num(0, 500),
};

const medicationFields = {
  name: reqText(120, "Medication name"),
  dose: text(60),
  frequency: text(60),
};

/** Whole years, or blank. */
const age = z.number().int().min(0).max(130).nullable();

/** The 4-step admission (as in the prototype's admit window): everything is saved in one transaction. */
export const admitSchema = z.object({
  bedId: z.string().min(1).max(8),
  // Step 1: admission and info
  // Every field is optional: a bed can be admitted with nothing filled in and completed later from the chart.
  patientName: text(120).default(""),
  age: age.default(null),
  // Missing means "now" (the server fills it in).
  admittedAt: isoDate.optional(),
  diagnosis: text(300).default(""),
  riskFactors: text(1000).default(""),
  // Step 2: first blood gas (optional)
  firstAbg: z.object(abgMeasures).nullable().default(null),
  // Step 3: insulin and drugs
  insulin: z.object(insulinDoses).default({ basalUnits: 0, breakfastUnits: 0, lunchUnits: 0, dinnerUnits: 0 }),
  medications: z.array(z.object(medicationFields)).max(30).default([]),
  // Step 4: workup and plan
  labsImaging: text(2000).default(""),
  consultations: text(2000).default(""),
  followupPlan: text(2000).default(""),
});
export type AdmitInput = z.input<typeof admitSchema>;

export const chartSchema = z.object({
  admissionId: z.uuid(),
  version: z.number().int().min(1),
  patientName: text(120).default(""),
  age,
  // Left out, the recorded admission time is kept.
  admittedAt: isoDate.optional(),
  diagnosis: text(300).default(""),
  riskFactors: text(1000),
  labsImaging: text(2000),
  consultations: text(2000),
  followupPlan: text(2000),
});

export const bedsideSchema = z.object({
  admissionId: z.uuid(),
  urineAcetone: urineAcetoneSchema,
  currentRbg: opt(0, 2000),
});

export const abgSchema = z.object({
  admissionId: z.uuid(),
  ...abgMeasures,
});
export type AbgInput = z.input<typeof abgSchema>;

export const deleteAbgSchema = z.object({ admissionId: z.uuid(), abgId: z.uuid() });

export const insulinSchema = z.object({
  admissionId: z.uuid(),
  version: z.number().int().min(1),
  ...insulinDoses,
});

export const addMedicationSchema = z.object({
  admissionId: z.uuid(),
  version: z.number().int().min(1),
  ...medicationFields,
});

export const removeMedicationSchema = z.object({
  admissionId: z.uuid(),
  version: z.number().int().min(1),
  medicationId: z.uuid(),
});

export const registerMediaSchema = z.object({
  admissionId: z.uuid(),
  objectKey: z.string().min(1).max(300),
  contentType: z.enum(["image/webp", "image/jpeg", "image/png"]),
  originalName: text(120),
});

export const deleteMediaSchema = z.object({ admissionId: z.uuid(), mediaId: z.uuid() });

export const dischargeSchema = z.object({
  admissionId: z.uuid(),
  version: z.number().int().min(1),
  outcome: z.enum(DISCHARGE_OUTCOMES),
  notes: text(3000).default(""),
});

export const themeSchema = z.object({ theme: z.enum(THEMES) });

export const readmitSchema = z.object({ admissionId: z.uuid() });

export const rosterSchema = z.object({
  doc1: reqText(120, "Duty doctor"),
  doc2: text(120).default(""),
  attending: reqText(120, "Attending"),
});

export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN, `Username needs at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username can have at most ${USERNAME_MAX} characters`)
  .regex(USERNAME_PATTERN, "Use only letters, numbers, dots and underscores")
  .transform(normalizeUsername);

const newPassword = z.string().min(10, "Use at least 10 characters").max(128);

export const createStaffSchema = z.object({
  username: usernameSchema,
  displayName: reqText(120, "Name"),
  badgeNo: text(60).default(""),
  role: z.enum(CLINICAL_ROLES as [string, ...string[]]),
  password: newPassword,
});

export const updateStaffSchema = z.object({
  userId: z.string().min(1),
  displayName: reqText(120, "Name"),
  badgeNo: text(60).default(""),
  role: z.enum(CLINICAL_ROLES as [string, ...string[]]),
  active: z.boolean(),
});

export const deleteStaffSchema = z.object({
  userId: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: newPassword,
});

/** The user replacing their own password (required while it is a temporary one). */
export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Choose a password different from the temporary one",
    path: ["newPassword"],
  });
