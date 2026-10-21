export type ClinicalRole = "attending" | "resident" | "nurse";
export const CLINICAL_ROLES: ClinicalRole[] = ["attending", "resident", "nurse"];

/**
 * Mirrors ROLE_PERMISSIONS in the prototype, made explicit per action.
 *  nurse     : record ABG / RBG / urine ketones, attach lab photos
 *  resident  : everything a nurse can + admit, edit chart, insulin, drugs, discharge
 *  attending : everything + shift roster + staff management
 * This file is pure so both the UI (to hide controls) and the server (to enforce) share it.
 * The server check is the one that counts.
 */
export const PERMISSIONS = {
  "abg.record": ["nurse", "resident", "attending"],
  "bedside.record": ["nurse", "resident", "attending"],
  "media.attach": ["nurse", "resident", "attending"],
  "abg.delete": ["resident", "attending"],
  "media.delete": ["resident", "attending"],
  "patient.admit": ["resident", "attending"],
  "chart.edit": ["resident", "attending"],
  "insulin.edit": ["resident", "attending"],
  "drugs.edit": ["resident", "attending"],
  "patient.discharge": ["resident", "attending"],
  "archive.readmit": ["resident", "attending"],
  "roster.edit": ["attending"],
  "staff.manage": ["attending"],
  // Every signed-in role can choose its own light, dark or system theme.
  "profile.theme": ["nurse", "resident", "attending"],
} as const satisfies Record<string, readonly ClinicalRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: ClinicalRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly ClinicalRole[]).includes(role);
}

export const ROLE_INFO: Record<ClinicalRole, { title: string; desc: string }> = {
  attending: {
    title: "Attending consultant",
    desc: "Full ward authority: admissions, clinical overrides, shift roster, archive and staff management.",
  },
  resident: {
    title: "Duty resident or fellow",
    desc: "Clinical ward operations: admissions, serial ABG recording, insulin titration, drug sheets and discharge to the archive.",
  },
  nurse: {
    title: "Ward nurse or POCT operator",
    desc: "Bedside monitoring: serial blood gas entry, fingerstick RBG, urine acetone logging and lab photo attachment.",
  },
};
