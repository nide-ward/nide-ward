import { describe, expect, it } from "vitest";
import { CLINICAL_ROLES, PERMISSIONS, can, type Permission } from "./permissions";

const ALL = Object.keys(PERMISSIONS) as Permission[];
const CLINICAL: Permission[] = [
  "abg.record", "bedside.record", "media.attach", "abg.delete", "media.delete", "patient.admit",
  "chart.edit", "insulin.edit", "drugs.edit", "patient.discharge", "archive.readmit", "archive.delete",
];
const PROFILE: Permission[] = ["profile.theme", "profile.password"];

describe("permissions", () => {
  it("has exactly the roles admin, attending and resident", () => {
    expect([...CLINICAL_ROLES].sort()).toEqual(["admin", "attending", "resident"]);
  });
  it("admin can do everything", () => {
    for (const p of ALL) expect(can("admin", p)).toBe(true);
  });
  for (const role of ["attending", "resident"] as const) {
    it(`${role} can do every clinical action and edit the roster, but not manage staff`, () => {
      for (const p of CLINICAL) expect(can(role, p)).toBe(true);
      expect(can(role, "roster.edit")).toBe(true);
      expect(can(role, "staff.manage")).toBe(false);
    });
  }
  it("every role has the profile permissions", () => {
    for (const role of CLINICAL_ROLES) for (const p of PROFILE) expect(can(role, p)).toBe(true);
  });
  it("only admin has staff.manage", () => {
    expect(CLINICAL_ROLES.filter((r) => can(r, "staff.manage"))).toEqual(["admin"]);
  });
  it("denies unknown or missing roles", () => {
    expect(can(null, "abg.record")).toBe(false);
    expect(can("nurse" as never, "abg.record")).toBe(false);
  });
});
