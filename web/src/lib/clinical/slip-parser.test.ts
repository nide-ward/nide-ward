import { describe, expect, it } from "vitest";
import { parseABGSlipText, SAMPLE_SLIP_DKA, SAMPLE_SLIP_RESOLVED } from "./slip-parser";

describe("parseABGSlipText", () => {
  it("parses the Radiometer DKA sample slip", () => {
    expect(parseABGSlipText(SAMPLE_SLIP_DKA)).toEqual({
      ph: 7.21,
      pco2: 29.4,
      po2: 88,
      hco3std: 12,
      hco3: 11.2,
      na: 136,
      k: 5.1,
      cl: 99,
      ca: 1.16,
      rbg: 340,
      hb: 13.5,
    });
  });

  it("parses the Roche resolved sample slip", () => {
    expect(parseABGSlipText(SAMPLE_SLIP_RESOLVED)).toEqual({
      ph: 7.37,
      pco2: 35,
      po2: 95,
      hco3std: 20.5,
      hco3: 20,
      na: 138,
      k: 4.4,
      cl: 102,
      ca: 1.18,
      rbg: 185,
      hb: 13.2,
    });
  });

  it("accepts decimal commas and separators", () => {
    expect(parseABGSlipText("pH: 7,31 pCO2=40 K 4,5 Na 140 Cl 100 HCO3 22 Glu 250")).toEqual({
      ph: 7.31,
      pco2: 40,
      hco3: 22,
      na: 140,
      k: 4.5,
      cl: 100,
      rbg: 250,
    });
  });

  it("returns an empty object for empty or unrecognisable text", () => {
    expect(parseABGSlipText("")).toEqual({});
    expect(parseABGSlipText(null)).toEqual({});
    expect(parseABGSlipText("garbage 7.3")).toEqual({});
  });
});
