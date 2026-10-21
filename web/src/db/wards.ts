/** Ward and bed definitions, ported from WARD_STRUCTURE in the prototype. Used by the seed script and the UI. */
export type BedType = "regular" | "extra" | "paid" | "overflow";

export interface WardSeed {
  id: string;
  title: string;
  description: string;
  beds: { id: string; name: string; type: BedType }[];
}

const beds = (prefix: string, count: number, type: BedType, label: (n: number) => string) =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i + 1}`, name: label(i + 1), type }));

export const WARDS: WardSeed[] = [
  {
    id: "female",
    title: "Female Ward",
    description: "7 Standard Beds (F-1 to F-7) + 3 Overflow Extra Beds (F-8 to F-10)",
    beds: [
      ...beds("F", 7, "regular", (n) => `Bed F-${n}`),
      ...[8, 9, 10].map((n) => ({ id: `F${n}`, name: `Extra Bed F-${n}`, type: "extra" as const })),
    ],
  },
  {
    id: "male",
    title: "Male Ward",
    description: "6 Standard Beds (M-1 to M-6) + 4 Overflow Extra Beds (M-7 to M-10)",
    beds: [
      ...beds("M", 6, "regular", (n) => `Bed M-${n}`),
      ...[7, 8, 9, 10].map((n) => ({ id: `M${n}`, name: `Extra Bed M-${n}`, type: "extra" as const })),
    ],
  },
  {
    id: "paid",
    title: "Paid Ward",
    description: "6 Dedicated Private Rooms/Beds (P-1 to P-6)",
    beds: beds("P", 6, "paid", (n) => `Bed P-${n}`),
  },
  {
    id: "overflow",
    title: "Additional / Overflow Floor",
    description: "6 Surge Beds for Ward Overflow Support (O-1 to O-6)",
    beds: beds("O", 6, "overflow", (n) => `Overflow Bed O-${n}`),
  },
];
