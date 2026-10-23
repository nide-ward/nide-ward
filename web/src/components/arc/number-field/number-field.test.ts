import { describe, expect, it } from "vitest";
import {
  countIntegerDigits,
  getMaxIntegerDigits,
  resolveDraftCommit,
  wouldExceedIntegerDigits,
} from "./number-field";

describe("getMaxIntegerDigits", () => {
  it("returns the number of digits in the integer portion of max", () => {
    expect(getMaxIntegerDigits(500)).toBe(3);
    expect(getMaxIntegerDigits(50)).toBe(2);
    expect(getMaxIntegerDigits(9)).toBe(1);
    expect(getMaxIntegerDigits(0)).toBe(1);
    expect(getMaxIntegerDigits(1000)).toBe(4);
    expect(getMaxIntegerDigits(500.75)).toBe(3);
  });

  it("returns null when max is unbounded or not finite", () => {
    expect(getMaxIntegerDigits(Number.MAX_SAFE_INTEGER)).toBeNull();
    expect(getMaxIntegerDigits(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("countIntegerDigits", () => {
  it("counts digits in integer strings", () => {
    expect(countIntegerDigits("123")).toBe(3);
    expect(countIntegerDigits("0")).toBe(1);
    expect(countIntegerDigits("")).toBe(0);
  });

  it("ignores non-digit characters like minus signs or group separators", () => {
    expect(countIntegerDigits("-12")).toBe(2);
    expect(countIntegerDigits("1,234")).toBe(4);
  });

  it("only counts digits before the decimal separator", () => {
    expect(countIntegerDigits("123.45", ".")).toBe(3);
    expect(countIntegerDigits("123,45", ",")).toBe(3);
    expect(countIntegerDigits("0.5", ".")).toBe(1);
  });
});

describe("wouldExceedIntegerDigits", () => {
  it("allows integer drafts up to max integer digits", () => {
    expect(wouldExceedIntegerDigits("1", 500)).toBe(false);
    expect(wouldExceedIntegerDigits("12", 500)).toBe(false);
    expect(wouldExceedIntegerDigits("123", 500)).toBe(false);
    expect(wouldExceedIntegerDigits("500", 500)).toBe(false);
    expect(wouldExceedIntegerDigits("600", 500)).toBe(false);
  });

  it("refuses drafts that would exceed max integer digits", () => {
    expect(wouldExceedIntegerDigits("1234", 500)).toBe(true);
    expect(wouldExceedIntegerDigits("1234567", 500)).toBe(true);
  });

  it("does not cap when max is MAX_SAFE_INTEGER", () => {
    expect(wouldExceedIntegerDigits("123456789", Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe("resolveDraftCommit", () => {
  const round = (n: number) => Math.round(n);

  it("reverts to editStart without strain when draft is empty or unparsable", () => {
    expect(
      resolveDraftCommit({
        draft: "",
        parsed: null,
        min: 0,
        max: 500,
        editStart: 18,
        round,
      }),
    ).toEqual({ action: "revert", value: 18 });

    expect(
      resolveDraftCommit({
        draft: "   ",
        parsed: null,
        min: 0,
        max: 500,
        editStart: 18,
        round,
      }),
    ).toEqual({ action: "revert", value: 18 });
  });

  it("reverts to editStart and triggers strain when draft exceeds max", () => {
    expect(
      resolveDraftCommit({
        draft: "600",
        parsed: 600,
        min: 0,
        max: 500,
        editStart: 18,
        round,
      }),
    ).toEqual({ action: "revert-strain", value: 18, edge: 1 });
  });

  it("reverts to editStart and triggers strain when draft is below min", () => {
    expect(
      resolveDraftCommit({
        draft: "-5",
        parsed: -5,
        min: 0,
        max: 500,
        editStart: 18,
        round,
      }),
    ).toEqual({ action: "revert-strain", value: 18, edge: -1 });

    expect(
      resolveDraftCommit({
        draft: "5",
        parsed: 5,
        min: 10,
        max: 500,
        editStart: 18,
        round,
      }),
    ).toEqual({ action: "revert-strain", value: 18, edge: -1 });
  });

  it("commits valid in-range values", () => {
    expect(
      resolveDraftCommit({
        draft: "24",
        parsed: 24,
        min: 0,
        max: 500,
        editStart: 18,
        round,
      }),
    ).toEqual({ action: "commit", value: 24 });

    expect(
      resolveDraftCommit({
        draft: "0",
        parsed: 0,
        min: 0,
        max: 500,
        editStart: 18,
        round,
      }),
    ).toEqual({ action: "commit", value: 0 });

    expect(
      resolveDraftCommit({
        draft: "500",
        parsed: 500,
        min: 0,
        max: 500,
        editStart: 18,
        round,
      }),
    ).toEqual({ action: "commit", value: 500 });
  });
});
