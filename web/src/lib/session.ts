import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getReadDb, schema } from "@/db";
import { getAuth } from "./auth";
import { parseTheme, type Theme } from "./theme";
import { can, type ClinicalRole, type Permission } from "./permissions";

export interface Staff {
  userId: string;
  username: string;
  displayName: string;
  badgeNo: string | null;
  role: ClinicalRole;
  theme: Theme;
  /** True until the user replaces the temporary password an attending gave them. */
  mustChangePassword: boolean;
}

export const CHANGE_PASSWORD_PATH = "/change-password";

/**
 * The signed-in, active staff member for this request, or null.
 * A valid Better Auth session without an active staff_profile is treated as signed out.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const [profile] = await getReadDb()
    .select()
    .from(schema.staffProfile)
    .where(eq(schema.staffProfile.userId, session.user.id))
    .limit(1);
  if (!profile || !profile.active) return null;
  return {
    userId: session.user.id,
    username: session.user.username ?? "",
    displayName: profile.displayName,
    badgeNo: profile.badgeNo,
    role: profile.clinicalRole,
    theme: parseTheme(profile.theme),
    mustChangePassword: profile.mustChangePassword,
  };
});

/**
 * For pages: redirect to /login when signed out, to the password screen while a temporary
 * password is still in use, and to the board when the role lacks permission.
 */
export async function requireStaff(permission?: Permission): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  if (staff.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  if (permission && !can(staff.role, permission)) redirect("/");
  return staff;
}
