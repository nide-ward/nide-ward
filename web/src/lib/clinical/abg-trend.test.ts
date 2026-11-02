import { describe, expect, it } from "vitest";
import { directionBetween, rangeStatus, readingDirections } from "./abg-trend";

describe("rangeStatus", () => {
  it("places a value against its normal range", () => {
    expect(rangeStatus("ph", 7.26)).toBe("low");
    expect(rangeStatus("ph", 7.4)).toBe("normal");
    expect(rangeStatus("rbg", 400)).toBe("high");
    expect(rangeStatus("k", null)).toBeNull();
  });
});

describe("directionBetween", () => {
  it("compares with the earlier value, and is null without one", () => {
    expect(directionBetween(7.26, 7.34)).toBe("up");
    expect(directionBetween(250, 200)).toBe("down");
    expect(directionBetween(7.4, 7.4)).toBeNull();
    expect(directionBetween(null, 7.4)).toBeNull();
  });
});

describe("readingDirections", () => {
  it("shows only pH and HCO3, gives the first reading none and then compares each value with the nearest earlier one", () => {
    const d = readingDirections([{ ph: 7.26, hco3: 12 }, { ph: 7.3 }, { ph: 7.3, hco3: 10, k: 3.7 }]);
    expect(d[0]).toEqual({});
    expect(d[1]).toEqual({ ph: "up" });
    expect(d[2]).toEqual({ hco3: "down" });
  });
  it("gives a single reading no arrows", () => {
    expect(readingDirections([{ ph: 7.3 }])).toEqual([{}]);
  });
});
