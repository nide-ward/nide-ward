import { describe, expect, it } from "vitest";
import { parseABGSlipText, parseABGSlipTexts, SAMPLE_SLIP_DKA, SAMPLE_SLIP_RESOLVED } from "./slip-parser";

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

  it("uses GEM 3000 row order when thermal-print labels are clipped or misread", () => {
    const ocrText = `Model: GEM 3000
Measured (37.0C)
>H 7.49
9C02 34 mmHg
?O2 54 mmHg
Va+ 127 mmol/L
<+ 3.6 mmol/L
3a++ 4.39 mmol/L
3lu 67 mg/dL
4ac 0.7 mmol/L
?Hct < 15 %

Derived Parameters
Ca++(7.4) 4.55 mmol/L
4C03- 25.9 mmol/L
4C03std 26.9 mmol/L
TCO2 26.9 mmol/L
3Eecf 2.6 mmol/L
3E(B) 2.8 mmol/L
S02c 90 %
?THbc -----`;

    expect(parseABGSlipText(ocrText)).toEqual({
      ph: 7.49,
      pco2: 34,
      po2: 54,
      na: 127,
      k: 3.6,
      ca: 4.39,
      rbg: 67,
      hco3: 25.9,
      hco3std: 26.9,
    });
  });

  it("merges two observed close-up OCR readings without accepting malformed digits", () => {
    const primary = `Measured (37.0C)
pH 7.47
pCO02 <B mmHg
Ras 94 matg
a+ 128 mmol/L
K+ 248 mmol/L
Ca++ 3.28 mmol/L
Glu 130 mg/dL
Hct 30 %
Derived Parameters
HCO03- 22.6 mmol/L
HCO3std 247.5 mmol/L
THbc 938i gpa.`;
    const enhanced = `Measured (37.0C)
pH 7.47
pCO02 31 mmHg
ROZ 94 mmHg
a+ 128 mmol/L
K+ 2.8 mmol/L
Ca++ 7-28 mmol/L
Glu 130 mg/dL
Hct 30 %
Derived Parameters
HCO03- 22.6 mmol/L
HCO3std 24.5 mmol/L
THbc 9.3 g/dL`;

    expect(parseABGSlipTexts([primary, enhanced])).toEqual({
      ph: 7.47,
      pco2: 31,
      po2: 94,
      na: 128,
      k: 2.8,
      ca: 3.28,
      rbg: 130,
      hco3: 22.6,
      hco3std: 24.5,
      hb: 9.3,
    });
  });

  it("rejects a hemoglobin with a dropped leading digit when its hematocrit disagrees", () => {
    const observedOcr = `Measured (37.0C)
Hct 57 %
Derived Parameters
Hbc 7.7 g/dL`;

    expect(parseABGSlipText(observedOcr)).toEqual({});
  });

  it("recognises the observed PGO2 and O2 gas-pair confusions only inside a GEM section", () => {
    const observedOcr = `Measured (37.00)
PH 7.53
PGO2 30 mmHg
02 87 mmHg
Nas 135 mmol/L
K+ 3.4 mmol/L
Ca++ 1.26 mmol/L
Glu 181 mg/dL
Hct 33 %
Derived Parameters
HCO3std 27.1 mmol/L
THbc 10.2 g/dL`;

    expect(parseABGSlipText(observedOcr)).toEqual({
      ph: 7.53,
      pco2: 30,
      po2: 87,
      na: 135,
      k: 3.4,
      ca: 1.26,
      rbg: 181,
      hco3std: 27.1,
      hb: 10.2,
    });
  });

  it("reads GEM 3000 THbc OCR variants (fMbe, Hobe) when Hct ratio confirms hemoglobin", () => {
    const primary = `Measured (37.0C)
SH 7.38
>C02 43 mmHg
Ja+ 128 mmol/L
{+ 3.4 mmol/L
Ja++ 3.48 mmol/L
51u 68 mg/dL
ict 57 %
Derived Parameters
1C03- 25.4 mmol /L
1C03std 23.8 mmol/L
fMbe ~~ 17.7 g/dL`;
    const enhanced = `Measured (37 .0C)
H 7.38
»C02 43 mmHg
»02 35 mmHg
la+ 128 mmol/L
+ 3.4 mmol/L
Jat+ 3.48 mmol/L
lu 68 mg/dL
ict 57 %
Derived Parameters
1C03- 25.4 mmol/L
{C03std 23.8 mmol/L
Hobe 17.7 g/dL`;

    expect(parseABGSlipTexts([primary, enhanced])).toEqual({
      ph: 7.38,
      pco2: 43,
      po2: 35,
      na: 128,
      k: 3.4,
      ca: 3.48,
      rbg: 68,
      hco3: 25.4,
      hco3std: 23.8,
      hb: 17.7,
    });
  });

  it("reads GEM 3000 pO2 when clipped >O2 is misread as 202 without accepting 202 on a garbled value", () => {
    const validGasPair = `Measureq (37.00) !
© OH 7.25 |
| 2C02 31 mmHg :
202 30 mmH
Derived Parameters
1C03- 13.6 mmol/L`;
    expect(parseABGSlipText(validGasPair)).toEqual({
      ph: 7.25,
      pco2: 31,
      po2: 30,
      hco3: 13.6,
    });

    const garbledPo2Value = `Measured (37.0C)
2C02 31 mmHg
202 <B mmHg
Derived Parameters`;
    expect(parseABGSlipText(garbledPo2Value)).toEqual({
      pco2: 31,
    });
  });

  it("returns an empty object for empty or unrecognisable text", () => {
    expect(parseABGSlipText("")).toEqual({});
    expect(parseABGSlipText(null)).toEqual({});
    expect(parseABGSlipText("garbage 7.3")).toEqual({});
  });
});
