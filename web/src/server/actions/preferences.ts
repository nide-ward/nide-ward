"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { getAuth } from "@/lib/auth";
import { changeOwnPasswordSchema, themeSchema } from "@/lib/validation";
import { ActionError, audit, runAction, type ActionResult } from "../action";

/**
 * The signed-in user replaces their password. Required on first sign-in and after an attending
 * resets it (staff_profile.must_change_password); allowed any time otherwise. Better Auth checks
 * the current password; other sessions are signed out.
 */
export async function changeOwnPassword(raw: unknown): Promise<ActionResult> {
  return runAction("profile.password", changeOwnPasswordSchema, raw, async ({ staff, input, db }) => {
    try {
      await getAuth().api.changePassword({
        body: { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/invalid password|incorrect/i.test(msg)) throw new ActionError("validation", "The current password is not correct.");
      throw e;
    }
    await db.transaction(async (tx) => {
      await tx.update(schema.staffProfile).set({ mustChangePassword: false, updatedAt: new Date() }).where(eq(schema.staffProfile.userId, staff.userId));
      // The password itself is never logged.
      await audit(tx, staff, "profile.password", "staff_profile", staff.userId, null, { mustChangePassword: false });
    });
  });
}

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
