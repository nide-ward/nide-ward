import { describe, expect, it } from "vitest";
import { normalizeNumericText } from "./numeric-input";

describe("normalizeNumericText", () => {
  it("leaves plain numbers alone", () => {
    expect(normalizeNumericText("7.21")).toBe("7.21");
    expect(normalizeNumericText("280")).toBe("280");
  });

  it("treats a comma as the decimal point", () => {
    expect(normalizeNumericText("7,21")).toBe("7.21");
    expect(normalizeNumericText("2,5")).toBe("2.5");
  });

  it("converts Arabic-Indic digits and the Arabic decimal separator", () => {
    expect(normalizeNumericText("٧٫٢١")).toBe("7.21");
    expect(normalizeNumericText("٢٨٠")).toBe("280");
  });

  it("converts Eastern Arabic-Indic digits", () => {
    expect(normalizeNumericText("۱۲۳")).toBe("123");
  });

  it("drops spaces and the Arabic thousands separator", () => {
    expect(normalizeNumericText(" 1٬200 ")).toBe("1200");
  });
});
