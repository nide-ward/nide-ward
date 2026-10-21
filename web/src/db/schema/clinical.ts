import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const clinicalRoleEnum = pgEnum("clinical_role", ["admin", "attending", "resident"]);
export const bedTypeEnum = pgEnum("bed_type", ["regular", "extra", "paid", "overflow"]);
export const admissionStatusEnum = pgEnum("admission_status", ["active", "discharged"]);
export const urineAcetoneEnum = pgEnum("urine_acetone", ["Negative", "Trace", "+", "++", "+++", "++++"]);

/** One row per staff login. The Better Auth user holds credentials; this holds clinical identity. */
export const staffProfile = pgTable("staff_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  badgeNo: text("badge_no"),
  clinicalRole: clinicalRoleEnum("clinical_role").notNull(),
  active: boolean("active").notNull().default(true),
  /** Display preference: light (default), dark, or system. Follows the user across devices. */
  theme: text("theme").notNull().default("light"),
  /** Set when an attending creates the account or resets the password; cleared once the user picks their own. */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ward = pgTable("ward", {
  id: text("id").primaryKey(), // female | male | paid | overflow
  title: text("title").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const bed = pgTable(
  "bed",
  {
    id: text("id").primaryKey(), // F1, M3, P2, O6 ...
    wardId: text("ward_id")
      .notNull()
      .references(() => ward.id),
    name: text("name").notNull(),
    type: bedTypeEnum("type").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("bed_ward_idx").on(t.wardId, t.sortOrder)],
);

/**
 * An admission is the single source of truth for a patient stay. The archive is
 * simply the admissions whose status is "discharged"; nothing is copied.
 * `version` is bumped by every guarded edit of the chart document so concurrent
 * edits can be detected (optimistic concurrency).
 */
export const admission = pgTable(
  "admission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bedId: text("bed_id")
      .notNull()
      .references(() => bed.id),
    patientName: text("patient_name").notNull(),
    age: integer("age"),
    diagnosis: text("diagnosis").notNull(),
    riskFactors: text("risk_factors").notNull().default(""),
    admittedAt: timestamp("admitted_at", { withTimezone: true }).notNull(),
    admittedBy: text("admitted_by").notNull(),
    status: admissionStatusEnum("status").notNull().default("active"),
    urineAcetone: urineAcetoneEnum("urine_acetone").notNull().default("Negative"),
    currentRbg: doublePrecision("current_rbg"),
    labsImaging: text("labs_imaging").notNull().default(""),
    consultations: text("consultations").notNull().default(""),
    followupPlan: text("followup_plan").notNull().default(""),
    dischargedAt: timestamp("discharged_at", { withTimezone: true }),
    dischargedBy: text("discharged_by"),
    dischargeOutcome: text("discharge_outcome"),
    dischargeNotes: text("discharge_notes"),
    attendingAtDischarge: text("attending_at_discharge"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A bed can hold at most one active admission, enforced by the database.
    uniqueIndex("admission_one_active_per_bed").on(t.bedId).where(sql`${t.status} = 'active'`),
    index("admission_status_idx").on(t.status, t.dischargedAt),
    index("admission_name_idx").on(t.patientName),
  ],
);

export const abgReading = pgTable(
  "abg_reading",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    admissionId: uuid("admission_id")
      .notNull()
      .references(() => admission.id, { onDelete: "cascade" }),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    ph: doublePrecision("ph"),
    pco2: doublePrecision("pco2"),
    po2: doublePrecision("po2"),
    hco3: doublePrecision("hco3"),
    hco3Std: doublePrecision("hco3_std"),
    na: doublePrecision("na"),
    k: doublePrecision("k"),
    cl: doublePrecision("cl"),
    ca: doublePrecision("ca"),
    rbg: doublePrecision("rbg"),
    hb: doublePrecision("hb"),
    recordedBy: text("recorded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("abg_admission_time_idx").on(t.admissionId, t.takenAt)],
);

/** Basal + per-meal bolus. One row per admission. */
export const insulinRegimen = pgTable("insulin_regimen", {
  admissionId: uuid("admission_id")
    .primaryKey()
    .references(() => admission.id, { onDelete: "cascade" }),
  basalUnits: doublePrecision("basal_units").notNull().default(0),
  basalLabel: text("basal_label").notNull().default("Lantus (Glargine) at 11:00 PM"),
  breakfastUnits: doublePrecision("breakfast_units").notNull().default(0),
  breakfastNotes: text("breakfast_notes").notNull().default("Actrapid before breakfast (9:00 AM)"),
  lunchUnits: doublePrecision("lunch_units").notNull().default(0),
  lunchNotes: text("lunch_notes").notNull().default("Actrapid before lunch (3:00 PM)"),
  dinnerUnits: doublePrecision("dinner_units").notNull().default(0),
  dinnerNotes: text("dinner_notes").notNull().default("Actrapid before dinner (9:00 PM)"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Concomitant (non-insulin) drug sheet. */
export const medication = pgTable(
  "medication",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    admissionId: uuid("admission_id")
      .notNull()
      .references(() => admission.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dose: text("dose").notNull().default("--"),
    frequency: text("frequency").notNull().default("OD"),
    addedBy: text("added_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("medication_admission_idx").on(t.admissionId)],
);

/** Metadata for lab photos. Bytes live in a private Cloudflare R2 bucket, never in the database. */
export const labMedia = pgTable(
  "lab_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    admissionId: uuid("admission_id")
      .notNull()
      .references(() => admission.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    originalName: text("original_name").notNull().default(""),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lab_media_admission_idx").on(t.admissionId)],
);

/** Append-only history of who covered the ward. The newest row is the current roster. */
export const shiftRoster = pgTable("shift_roster", {
  id: serial("id").primaryKey(),
  doc1: text("doc1").notNull(),
  doc2: text("doc2"),
  attending: text("attending").notNull(),
  shiftStart: text("shift_start").notNull().default("09:00 AM"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every mutation writes a row here, in the same transaction as the change. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId, t.at), index("audit_at_idx").on(t.at)],
);
