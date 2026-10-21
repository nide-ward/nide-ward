"use server";

import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { themeSchema } from "@/lib/validation";
import { audit, runAction, type ActionResult } from "../action";

/** Saves the signed-in user's colour theme (light, dark or system). Any role may change its own. */
export async function setTheme(raw: unknown): Promise<ActionResult<{ theme: string }>> {
  return runAction("profile.theme", themeSchema, raw, async ({ staff, input, db }) =>
    db.transaction(async (tx) => {
      const [before] = await tx.select({ theme: schema.staffProfile.theme }).from(schema.staffProfile).where(eq(schema.staffProfile.userId, staff.userId));
      await tx.update(schema.staffProfile).set({ theme: input.theme, updatedAt: new Date() }).where(eq(schema.staffProfile.userId, staff.userId));
      await audit(tx, staff, "profile.theme", "staff_profile", staff.userId, before ?? null, { theme: input.theme });
      return { theme: input.theme };
    }),
  );
}
