import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("permissions", () => {
  it("nurse can record but not admit, edit or discharge", () => {
    expect(can("nurse", "abg.record")).toBe(true);
    expect(can("nurse", "bedside.record")).toBe(true);
    expect(can("nurse", "media.attach")).toBe(true);
    expect(can("nurse", "patient.admit")).toBe(false);
    expect(can("nurse", "chart.edit")).toBe(false);
    expect(can("nurse", "insulin.edit")).toBe(false);
    expect(can("nurse", "patient.discharge")).toBe(false);
  });
  it("resident gets clinical operations but not roster or staff", () => {
    for (const p of ["patient.admit", "chart.edit", "insulin.edit", "drugs.edit", "patient.discharge", "abg.record"] as const) {
      expect(can("resident", p)).toBe(true);
    }
    expect(can("resident", "roster.edit")).toBe(false);
    expect(can("resident", "staff.manage")).toBe(false);
  });
  it("attending can do everything", () => {
    expect(can("attending", "roster.edit")).toBe(true);
    expect(can("attending", "staff.manage")).toBe(true);
    expect(can("attending", "patient.discharge")).toBe(true);
  });
  it("denies when there is no role", () => {
    expect(can(null, "abg.record")).toBe(false);
  });
});
