import { analyzeABG, type AbgEntry } from "./abg";

export type TrendParam = "ph" | "pco2" | "hco3" | "ag" | "rbg" | "k" | "na" | "po2" | "hb";

/** Normal range per value. A bound nobody worries about crossing is left at its natural floor (AG from 0). */
export const NORMAL_RANGE: Record<TrendParam, readonly [number, number]> = {
  ph: [7.35, 7.45],
  pco2: [35, 45],
  hco3: [22, 26],
  ag: [0, 12],
  rbg: [70, 140],
  k: [3.5, 5],
  na: [135, 145],
  po2: [80, 100],
  hb: [12, 17],
};

export type Direction = "up" | "down";

/** Only these values show a movement arrow. */
export const ARROW_PARAMS: readonly TrendParam[] = ["ph", "hco3"];
export type RangeStatus = "low" | "normal" | "high";

/** Where a value sits against its normal range. Null when there is no value. */
export function rangeStatus(param: TrendParam, value: number | null | undefined): RangeStatus | null {
  if (value === null || value === undefined) return null;
  const [lo, hi] = NORMAL_RANGE[param];
  return value < lo ? "low" : value > hi ? "high" : "normal";
}

/** Which way a value moved against the reading before it. Null when there is nothing earlier to compare with, or it did not change. */
export function directionBetween(previous: number | null | undefined, current: number | null | undefined): Direction | null {
  if (previous === null || previous === undefined || current === null || current === undefined) return null;
  return current > previous ? "up" : current < previous ? "down" : null;
}

/** Value of `param` for a reading, with the anion gap derived from its electrolytes. */
export function readingValue(param: TrendParam, entry: AbgEntry): number | null {
  if (param === "ag") return analyzeABG(entry)?.ag ?? null;
  return entry[param] ?? null;
}

/**
 * The direction of every value in each reading against the nearest earlier reading that has that value.
 * `rows` is oldest first; the result lines up with it. A value with nothing earlier gets no entry.
 */
export function readingDirections(rows: AbgEntry[]): Partial<Record<TrendParam, Direction>>[] {
  const last: Partial<Record<TrendParam, number>> = {};
  return rows.map((row) => {
    const out: Partial<Record<TrendParam, Direction>> = {};
    for (const param of ARROW_PARAMS) {
      const value = readingValue(param, row);
      if (value === null) continue;
      const direction = directionBetween(last[param], value);
      if (direction) out[param] = direction;
      last[param] = value;
    }
    return out;
  });
}
