"use server";

import { headers } from "next/headers";
import { and, count, eq } from "drizzle-orm";
import { schema } from "@/db";
import { getAuth, platformRoleFor } from "@/lib/auth";
import type { ClinicalRole } from "@/lib/permissions";
import { createStaffSchema, deleteStaffSchema, resetPasswordSchema, updateStaffSchema } from "@/lib/validation";
import { ActionError, audit, runAction, type ActionResult } from "../action";

const { staffProfile } = schema;

/** Attending-only. Creates the Better Auth credential (admin plugin) and the clinical profile. */
export async function createStaff(raw: unknown): Promise<ActionResult<{ userId: string }>> {
  return runAction("staff.manage", createStaffSchema, raw, async ({ staff, input, db }) => {
    const role = input.role as ClinicalRole;
    const auth = getAuth();
    let userId: string;
    try {
      const created = await auth.api.createUser({
        body: {
          email: input.email,
          password: input.password,
          name: input.displayName,
          role: platformRoleFor(role),
        },
        headers: await headers(),
      });
      userId = created.user.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/exist/i.test(msg)) throw new ActionError("conflict", "An account with that email already exists.");
      throw e;
    }
    try {
      await db.transaction(async (tx) => {
        const [profile] = await tx
          .insert(staffProfile)
          .values({ userId, displayName: input.displayName, badgeNo: input.badgeNo || null, clinicalRole: role })
          .returning();
        await audit(tx, staff, "staff.create", "staff_profile", userId, null, { ...profile, email: input.email });
      });
    } catch (e) {
      // Do not leave a credential without a profile behind.
      await auth.api.removeUser({ body: { userId }, headers: await headers() }).catch(() => undefined);
      throw e;
    }
    return { userId };
  });
}

export async function updateStaff(raw: unknown): Promise<ActionResult> {
  return runAction("staff.manage", updateStaffSchema, raw, async ({ staff, input, db }) => {
    const role = input.role as ClinicalRole;
    const auth = getAuth();
    const [before] = await db.select().from(staffProfile).where(eq(staffProfile.userId, input.userId));
    if (!before) throw new ActionError("not_found", "That staff member no longer exists.");

    const losingAttending = before.clinicalRole === "attending" && before.active && (role !== "attending" || !input.active);
    if (losingAttending) {
      if (input.userId === staff.userId) {
        throw new ActionError("invalid_state", "You cannot demote or deactivate your own attending account.");
      }
      const [{ n }] = await db
        .select({ n: count() })
        .from(staffProfile)
        .where(and(eq(staffProfile.clinicalRole, "attending"), eq(staffProfile.active, true)));
      if (n <= 1) throw new ActionError("invalid_state", "There must be at least one active attending.");
    }

    await db.transaction(async (tx) => {
      const [after] = await tx
        .update(staffProfile)
        .set({
          displayName: input.displayName,
          badgeNo: input.badgeNo || null,
          clinicalRole: role,
          active: input.active,
          updatedAt: new Date(),
        })
        .where(eq(staffProfile.userId, input.userId))
        .returning();
      await audit(tx, staff, "staff.update", "staff_profile", input.userId, before, after);
    });

    const h = await headers();
    if (role !== before.clinicalRole) {
      await auth.api.setRole({ body: { userId: input.userId, role: platformRoleFor(role) }, headers: h });
    }
    if (before.active && !input.active) {
      await auth.api.revokeUserSessions({ body: { userId: input.userId }, headers: h });
    }
  });
}

/**
 * Attending-only. Permanently deletes the login (user row; sessions, accounts and the staff
 * profile cascade). Clinical records keep the recorder's name as text, so history is untouched.
 * The delete and its audit row commit together.
 */
export async function deleteStaff(raw: unknown): Promise<ActionResult> {
  return runAction("staff.manage", deleteStaffSchema, raw, async ({ staff, input, db }) => {
    if (input.userId === staff.userId) {
      throw new ActionError("invalid_state", "You cannot delete your own account.");
    }
    await db.transaction(async (tx) => {
      const [before] = await tx
        .select({ profile: staffProfile, email: schema.user.email })
        .from(staffProfile)
        .innerJoin(schema.user, eq(schema.user.id, staffProfile.userId))
        .where(eq(staffProfile.userId, input.userId))
        .for("update");
      if (!before) throw new ActionError("not_found", "That staff member no longer exists.");

      if (before.profile.clinicalRole === "attending" && before.profile.active) {
        // Lock every active attending so two attendings cannot delete each other at once.
        const attendings = await tx
          .select({ userId: staffProfile.userId })
          .from(staffProfile)
          .where(and(eq(staffProfile.clinicalRole, "attending"), eq(staffProfile.active, true)))
          .for("update");
        if (attendings.length <= 1) throw new ActionError("invalid_state", "There must be at least one active attending.");
      }

      await tx.delete(schema.user).where(eq(schema.user.id, input.userId));
      await audit(tx, staff, "staff.delete", "staff_profile", input.userId, { ...before.profile, email: before.email }, null);
    });
  });
}

export async function resetStaffPassword(raw: unknown): Promise<ActionResult> {
  return runAction("staff.manage", resetPasswordSchema, raw, async ({ staff, input, db }) => {
    const auth = getAuth();
    const h = await headers();
    await auth.api.setUserPassword({ body: { userId: input.userId, newPassword: input.password }, headers: h });
    await auth.api.revokeUserSessions({ body: { userId: input.userId }, headers: h });
    await db.transaction(async (tx) => {
      // The password itself is never logged.
      await audit(tx, staff, "staff.reset_password", "staff_profile", input.userId, null, null);
    });
  });
}
