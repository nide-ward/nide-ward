"use server";

import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { ActionError, audit, runAction, type ActionResult } from "../action";
import { rosterSchema } from "@/lib/validation";

export async function saveRoster(raw: unknown): Promise<ActionResult> {
  return runAction("roster.edit", rosterSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      // Ensure no administrators are included in the roster slots
      const adminProfiles = await tx
        .select({ displayName: schema.staffProfile.displayName })
        .from(schema.staffProfile)
        .where(eq(schema.staffProfile.clinicalRole, "admin"));

      const adminNames = adminProfiles.map((a) => a.displayName.toLowerCase().trim()).filter(Boolean);
      const isAdmin = (name: string | null | undefined) => {
        if (!name) return false;
        const lower = name.toLowerCase().trim();
        return adminNames.some((adminName) => lower === adminName || lower.includes(adminName) || adminName.includes(lower));
      };

      if (isAdmin(input.doc1) || isAdmin(input.doc2) || isAdmin(input.attending)) {
        throw new ActionError("validation", "Administrators cannot be assigned to resident or attending shift roster duties.");
      }

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
