"use server";

import { schema } from "@/db";
import { rosterSchema } from "@/lib/validation";
import { audit, runAction, type ActionResult } from "../action";

export async function saveRoster(raw: unknown): Promise<ActionResult> {
  return runAction("roster.edit", rosterSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.shiftRoster)
        .values({
          doc1: input.doc1,
          doc2: input.doc2 || null,
          attending: input.attending,
          updatedBy: staff.displayName,
        })
        .returning();
      await audit(tx, staff, "roster.update", "shift_roster", String(row.id), null, row);
    }),
  );
}
