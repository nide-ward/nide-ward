"use server";

import { and, eq } from "drizzle-orm";
import { schema } from "@/db";
import { abgSchema, deleteAbgSchema } from "@/lib/validation";
import { ActionError, audit, requireActiveAdmission, runAction, type ActionResult } from "../action";

export async function addAbgReading(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction("abg.record", abgSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      await requireActiveAdmission(tx, input.admissionId);
      const { admissionId, ...measures } = input;
      const [row] = await tx
        .insert(schema.abgReading)
        .values({ admissionId, ...measures, recordedBy: staff.displayName })
        .returning();
      await audit(tx, staff, "abg.add", "abg_reading", row.id, null, row);
      return { id: row.id };
    }),
  );
}

export async function deleteAbgReading(raw: unknown): Promise<ActionResult> {
  return runAction("abg.delete", deleteAbgSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      await requireActiveAdmission(tx, input.admissionId);
      const [row] = await tx
        .delete(schema.abgReading)
        .where(and(eq(schema.abgReading.id, input.abgId), eq(schema.abgReading.admissionId, input.admissionId)))
        .returning();
      if (!row) throw new ActionError("not_found", "That reading was already removed.");
      await audit(tx, staff, "abg.delete", "abg_reading", row.id, row, null);
    }),
  );
}
