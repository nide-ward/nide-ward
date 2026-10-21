import { describe, expect, it } from "vitest";
import { ageShort, ageText, isBlank, parseAgeInput, patientLabel } from "./display";
import { parseTheme } from "./theme";

describe("blank patient details", () => {
  it("labels unnamed patients, with the bed when it is not otherwise shown", () => {
    expect(patientLabel("  ")).toBe("Unnamed patient");
    expect(patientLabel("", "Bed F-1")).toBe("Unnamed patient (Bed F-1)");
    expect(patientLabel(" Amina ", "Bed F-1")).toBe("Amina");
  });
  it("omits a blank age", () => {
    expect(ageText(null)).toBe("");
    expect(ageShort(null)).toBe("");
    expect(ageText(58)).toBe("58 years");
    expect(ageText(0)).toBe("0 years");
  });
  it("detects blank text", () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank("  ")).toBe(true);
    expect(isBlank("DKA")).toBe(false);
  });
  it("accepts a blank age or whole years from 0 to 130", () => {
    expect(parseAgeInput("")).toEqual({ value: null, valid: true });
    expect(parseAgeInput("58")).toEqual({ value: 58, valid: true });
    expect(parseAgeInput("0")).toEqual({ value: 0, valid: true });
    expect(parseAgeInput("131").valid).toBe(false);
    expect(parseAgeInput("5.5").valid).toBe(false);
    expect(parseAgeInput("abc").valid).toBe(false);
  });
});

describe("theme", () => {
  it("defaults to light for anything unknown", () => {
    expect(parseTheme(undefined)).toBe("light");
    expect(parseTheme("purple")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });
});
