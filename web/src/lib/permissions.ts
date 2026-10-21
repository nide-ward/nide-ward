export type ClinicalRole = "admin" | "attending" | "resident";
export const CLINICAL_ROLES: ClinicalRole[] = ["admin", "attending", "resident"];

const ALL: readonly ClinicalRole[] = ["admin", "attending", "resident"];
const ADMIN_ONLY: readonly ClinicalRole[] = ["admin"];

/**
 * Per-action permission matrix.
 *  admin     : everything, including staff management
 *  attending : every clinical action and the shift roster
 *  resident  : every clinical action and the shift roster
 * Only staff management is restricted to admin. This file is pure so both the UI (to hide controls)
 * and the server (to enforce) share it. The server check is the one that counts.
 */
export const PERMISSIONS = {
  "abg.record": ALL,
  "bedside.record": ALL,
  "media.attach": ALL,
  "abg.delete": ALL,
  "media.delete": ALL,
  "patient.admit": ALL,
  "chart.edit": ALL,
  "insulin.edit": ALL,
  "drugs.edit": ALL,
  "patient.discharge": ALL,
  "archive.readmit": ALL,
  "roster.edit": ALL,
  "staff.manage": ADMIN_ONLY,
  // Every signed-in role can choose its own light, dark or system theme.
  "profile.theme": ALL,
  // Every signed-in role sets its own password (required on first sign-in and after a reset).
  "profile.password": ALL,
} as const satisfies Record<string, readonly ClinicalRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: ClinicalRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly ClinicalRole[]).includes(role);
}

export const ROLE_INFO: Record<ClinicalRole, { title: string; desc: string }> = {
  admin: {
    title: "Administrator",
    desc: "Everything: all clinical actions, the shift roster, and staff management (create, edit, deactivate, reset passwords, delete).",
  },
  attending: {
    title: "Attending",
    desc: "All clinical actions: admissions, chart, insulin, drugs, blood gases, discharge and the archive, plus the shift roster.",
  },
  resident: {
    title: "Resident",
    desc: "All clinical actions: admissions, chart, insulin, drugs, blood gases, discharge and the archive, plus the shift roster.",
  },
};
