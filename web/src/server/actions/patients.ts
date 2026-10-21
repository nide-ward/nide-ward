"use server";

import { and, desc, eq } from "drizzle-orm";
import { schema } from "@/db";
import { deleteObject } from "@/lib/storage";
import {
  addMedicationSchema,
  admitSchema,
  bedsideSchema,
  chartSchema,
  deleteArchivedSchema,
  dischargeSchema,
  insulinSchema,
  readmitSchema,
  removeMedicationSchema,
} from "@/lib/validation";
import { ActionError, audit, guardedUpdate, requireActiveAdmission, runAction, type ActionResult } from "../action";

const { abgReading, admission, bed, insulinRegimen, labMedia, medication, shiftRoster } = schema;

export async function admitPatient(raw: unknown): Promise<ActionResult<{ admissionId: string }>> {
  return runAction("patient.admit", admitSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      const [b] = await tx.select().from(bed).where(eq(bed.id, input.bedId));
      if (!b) throw new ActionError("not_found", "That bed does not exist.");
      const [occupied] = await tx
        .select({ id: admission.id })
        .from(admission)
        .where(and(eq(admission.bedId, input.bedId), eq(admission.status, "active")));
      if (occupied) throw new ActionError("conflict", "That bed is already occupied. Reload the board.");

      const [created] = await tx
        .insert(admission)
        .values({
          bedId: input.bedId,
          patientName: input.patientName,
          age: input.age,
          diagnosis: input.diagnosis,
          riskFactors: input.riskFactors,
          admittedAt: input.admittedAt ?? new Date(),
          admittedBy: staff.displayName,
          labsImaging: input.labsImaging,
          consultations: input.consultations,
          followupPlan: input.followupPlan,
        })
        .returning();
      await audit(tx, staff, "admission.create", "admission", created.id, null, created);

      const [regimen] = await tx
        .insert(insulinRegimen)
        .values({ admissionId: created.id, ...input.insulin, updatedBy: staff.displayName })
        .returning();
      await audit(tx, staff, "insulin.update", "insulin_regimen", created.id, null, regimen);

      for (const m of input.medications) {
        const [row] = await tx
          .insert(medication)
          .values({ admissionId: created.id, name: m.name, dose: m.dose || "--", frequency: m.frequency || "OD", addedBy: staff.displayName })
          .returning();
        await audit(tx, staff, "medication.add", "medication", row.id, null, row);
      }

      if (input.firstAbg) {
        const [row] = await tx
          .insert(abgReading)
          .values({ admissionId: created.id, ...input.firstAbg, recordedBy: staff.displayName })
          .returning();
        await audit(tx, staff, "abg.add", "abg_reading", row.id, null, row);
      }
      return { admissionId: created.id };
    }),
  );
}

export async function updateChart(raw: unknown): Promise<ActionResult<{ version: number }>> {
  return runAction("chart.edit", chartSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      const { before, after } = await guardedUpdate(tx, input.admissionId, input.version, {
        patientName: input.patientName,
        age: input.age,
        admittedAt: input.admittedAt,
        diagnosis: input.diagnosis,
        riskFactors: input.riskFactors,
        labsImaging: input.labsImaging,
        consultations: input.consultations,
        followupPlan: input.followupPlan,
      });
      await audit(tx, staff, "admission.update", "admission", input.admissionId, before, after);
      return { version: after.version };
    }),
  );
}

/**
 * Fingerstick RBG and urine acetone. Nurses may do this, so it is deliberately outside the
 * version-guarded chart document: a resident logging acetone must not conflict with an attending editing the plan.
 */
export async function recordBedside(raw: unknown): Promise<ActionResult> {
  return runAction("bedside.record", bedsideSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      const before = await requireActiveAdmission(tx, input.admissionId);
      const [after] = await tx
        .update(admission)
        .set({ urineAcetone: input.urineAcetone, currentRbg: input.currentRbg, updatedAt: new Date() })
        .where(eq(admission.id, input.admissionId))
        .returning();
      await audit(
        tx,
        staff,
        "bedside.record",
        "admission",
        input.admissionId,
        { urineAcetone: before.urineAcetone, currentRbg: before.currentRbg },
        { urineAcetone: after.urineAcetone, currentRbg: after.currentRbg },
      );
    }),
  );
}

export async function saveInsulin(raw: unknown): Promise<ActionResult<{ version: number }>> {
  return runAction("insulin.edit", insulinSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      const { after } = await guardedUpdate(tx, input.admissionId, input.version);
      const [prev] = await tx.select().from(insulinRegimen).where(eq(insulinRegimen.admissionId, input.admissionId));
      const values = {
        basalUnits: input.basalUnits,
        breakfastUnits: input.breakfastUnits,
        lunchUnits: input.lunchUnits,
        dinnerUnits: input.dinnerUnits,
        updatedBy: staff.displayName,
        updatedAt: new Date(),
      };
      const [next] = await tx
        .insert(insulinRegimen)
        .values({ admissionId: input.admissionId, ...values })
        .onConflictDoUpdate({ target: insulinRegimen.admissionId, set: values })
        .returning();
      await audit(tx, staff, "insulin.update", "insulin_regimen", input.admissionId, prev ?? null, next);
      return { version: after.version };
    }),
  );
}

export async function addMedication(raw: unknown): Promise<ActionResult<{ version: number }>> {
  return runAction("drugs.edit", addMedicationSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      const { after } = await guardedUpdate(tx, input.admissionId, input.version);
      const [row] = await tx
        .insert(medication)
        .values({
          admissionId: input.admissionId,
          name: input.name,
          dose: input.dose || "--",
          frequency: input.frequency || "OD",
          addedBy: staff.displayName,
        })
        .returning();
      await audit(tx, staff, "medication.add", "medication", row.id, null, row);
      return { version: after.version };
    }),
  );
}

export async function removeMedication(raw: unknown): Promise<ActionResult<{ version: number }>> {
  return runAction("drugs.edit", removeMedicationSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      const { after } = await guardedUpdate(tx, input.admissionId, input.version);
      const [row] = await tx
        .delete(medication)
        .where(and(eq(medication.id, input.medicationId), eq(medication.admissionId, input.admissionId)))
        .returning();
      if (!row) throw new ActionError("not_found", "That medication was already removed.");
      await audit(tx, staff, "medication.remove", "medication", row.id, row, null);
      return { version: after.version };
    }),
  );
}

export async function dischargePatient(raw: unknown): Promise<ActionResult> {
  return runAction("patient.discharge", dischargeSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      const [roster] = await tx.select().from(shiftRoster).orderBy(desc(shiftRoster.id)).limit(1);
      const { before, after } = await guardedUpdate(tx, input.admissionId, input.version, {
        status: "discharged",
        dischargedAt: new Date(),
        dischargedBy: staff.displayName,
        dischargeOutcome: input.outcome,
        dischargeNotes: input.notes,
        attendingAtDischarge: roster?.attending ?? null,
      });
      await audit(tx, staff, "admission.discharge", "admission", input.admissionId, before, after);
    }),
  );
}

/** Re-admit an archived patient to their original bed (prototype "Re-admit"). The bed must be free. */
export async function readmitPatient(raw: unknown): Promise<ActionResult> {
  return runAction("archive.readmit", readmitSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      const [before] = await tx.select().from(admission).where(eq(admission.id, input.admissionId)).for("update");
      if (!before) throw new ActionError("not_found", "That record no longer exists.");
      if (before.status !== "discharged") throw new ActionError("invalid_state", "This patient is already on the ward.");
      const [taken] = await tx
        .select({ id: admission.id })
        .from(admission)
        .where(and(eq(admission.bedId, before.bedId), eq(admission.status, "active")));
      if (taken) throw new ActionError("conflict", `Bed ${before.bedId} is occupied. Free the bed first.`);
      const [after] = await tx
        .update(admission)
        .set({
          status: "active",
          dischargedAt: null,
          dischargedBy: null,
          dischargeOutcome: null,
          dischargeNotes: null,
          attendingAtDischarge: null,
          version: before.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(admission.id, input.admissionId))
        .returning();
      await audit(tx, staff, "admission.readmit", "admission", input.admissionId, before, after);
    }),
  );
}

/** Permanently remove a discharged admission (and cascaded chart rows) from the archive. */
export async function deleteArchivedAdmission(raw: unknown): Promise<ActionResult> {
  return runAction("archive.delete", deleteArchivedSchema, raw, async ({ staff, input, db }) => {
    const objectKeys = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(admission).where(eq(admission.id, input.admissionId)).for("update");
      if (!before) throw new ActionError("not_found", "That record no longer exists.");
      if (before.status !== "discharged") {
        throw new ActionError("invalid_state", "Only discharged records can be deleted. Discharge the patient first.");
      }
      const media = await tx.select({ objectKey: labMedia.objectKey }).from(labMedia).where(eq(labMedia.admissionId, input.admissionId));
      await tx.delete(admission).where(eq(admission.id, input.admissionId));
      await audit(tx, staff, "admission.delete", "admission", input.admissionId, before, null);
      return media.map((m) => m.objectKey);
    });
    for (const key of objectKeys) {
      await deleteObject(key).catch((e) => console.warn("Could not delete object", key, e));
    }
  });
}
