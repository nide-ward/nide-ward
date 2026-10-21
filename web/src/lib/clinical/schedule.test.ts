import { describe, expect, it } from "vitest";
import { calculateABGStatus, formatSlot } from "./schedule";
import { fromCairoInputValue, toCairoInputValue } from "../time";

// 2026-10-21 is in Egypt's standard time (UTC+2) in this test setup unless DST applies; build instants from Cairo wall time
// so the tests do not depend on the offset in force.
const at = (cairo: string) => fromCairoInputValue(cairo)!;

describe("formatSlot", () => {
  it("formats hours like the prototype", () => {
    expect(formatSlot(3)).toBe("03:00 AM");
    expect(formatSlot(11)).toBe("11:00 AM");
    expect(formatSlot(15)).toBe("03:00 PM");
    expect(formatSlot(23)).toBe("11:00 PM");
    expect(formatSlot(0)).toBe("12:00 AM");
  });
});

describe("calculateABGStatus", () => {
  it("is due with the next slot when there is no reading", () => {
    expect(calculateABGStatus(null, at("2026-10-21T08:30"))).toEqual({ isDue: true, text: "ABG Due (Next: 11:00 AM)" });
    expect(calculateABGStatus(null, at("2026-10-21T01:00"))).toEqual({ isDue: true, text: "ABG Due (Next: 03:00 AM)" });
    expect(calculateABGStatus(null, at("2026-10-21T23:30"))).toEqual({ isDue: true, text: "ABG Due (Next: 03:00 AM)" });
  });

  it("is not due within 4 hours of the last reading and names the next slot", () => {
    expect(calculateABGStatus(at("2026-10-21T07:00"), at("2026-10-21T09:00"))).toEqual({ isDue: false, text: "Next: 11:00 AM" });
    expect(calculateABGStatus(at("2026-10-21T07:00"), at("2026-10-21T10:59"))).toEqual({ isDue: false, text: "Next: 11:00 AM" });
  });

  it("is due at exactly 4 hours and names the missed slot", () => {
    expect(calculateABGStatus(at("2026-10-21T07:00"), at("2026-10-21T11:00"))).toEqual({ isDue: true, text: "ABG Due (Missed 11:00 AM)" });
    expect(calculateABGStatus(at("2026-10-21T07:00"), at("2026-10-21T12:15"))).toEqual({ isDue: true, text: "ABG Due (Missed 11:00 AM)" });
  });

  it("wraps across midnight", () => {
    expect(calculateABGStatus(at("2026-10-20T19:00"), at("2026-10-21T02:00"))).toEqual({ isDue: true, text: "ABG Due (Missed 11:00 PM)" });
    expect(calculateABGStatus(at("2026-10-21T00:30"), at("2026-10-21T01:00"))).toEqual({ isDue: false, text: "Next: 03:00 AM" });
    expect(calculateABGStatus(at("2026-10-21T22:00"), at("2026-10-21T23:30"))).toEqual({ isDue: false, text: "Next: 03:00 AM" });
  });
});

describe("Cairo time conversion", () => {
  it("round-trips wall-clock values", () => {
    for (const v of ["2026-01-15T03:00", "2026-07-15T23:45", "2026-10-21T00:00"]) {
      expect(toCairoInputValue(fromCairoInputValue(v)!)).toBe(v);
    }
  });
  it("rejects malformed input", () => {
    expect(fromCairoInputValue("not a date")).toBeNull();
  });
});
