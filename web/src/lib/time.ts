import { CAIRO_TZ } from "./clinical/schedule";

/**
 * Clinical times are Cairo wall-clock times. These helpers convert between instants (stored as
 * timestamptz) and the "YYYY-MM-DDTHH:mm" strings used by datetime-local inputs, independent of
 * the device's own time zone.
 */

const pad = (n: number) => n.toString().padStart(2, "0");

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute"), s: get("second") };
}

/** Instant -> "YYYY-MM-DDTHH:mm" on the Cairo wall clock. */
export function toCairoInputValue(date: Date): string {
  const p = partsIn(date, CAIRO_TZ);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** "YYYY-MM-DDTHH:mm" read as Cairo wall-clock time -> instant. Returns null when unparseable. */
export function fromCairoInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Find the offset in force at (roughly) that instant, then correct once more to handle DST edges.
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(guess), CAIRO_TZ);
    const shown = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    guess += asUtc - shown;
  }
  const result = new Date(guess);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** "2026-10-21 07:00" style label on the Cairo clock (the format the prototype stored). */
export function formatCairo(date: Date | string | null | undefined): string {
  if (!date) return "--";
  const d = typeof date === "string" ? new Date(date) : date;
  return toCairoInputValue(d).replace("T", " ");
}

export function formatCairoLong(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** Date part only, "YYYY-MM-DD", for the Cairo clock. */
export function cairoDateKey(date: Date): string {
  return toCairoInputValue(date).slice(0, 10);
}
