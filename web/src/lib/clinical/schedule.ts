/** Fixed 4-hourly ABG schedule: 3, 7, 11 AM and PM (Cairo wall clock). */
export const FIXED_ABG_HOURS = [3, 7, 11, 15, 19, 23] as const;

export const CAIRO_TZ = "Africa/Cairo";

/** Hour and minute on the Cairo wall clock for an instant. */
export function cairoHourMinute(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get("hour") % 24, minute: get("minute") };
}

export function formatSlot(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, "0")}:00 ${ampm}`;
}

export interface AbgStatus {
  isDue: boolean;
  text: string;
}

/**
 * Port of calculateABGStatus. A patient is "due" when there is no reading, or the
 * latest reading is 4 hours old or more. The slot named in the text is derived from
 * the Cairo wall clock exactly as in the prototype.
 *
 * `lastTakenAt` is the time of the most recent reading (the one logged last, as in the
 * prototype, which looked at the last array element).
 */
export function calculateABGStatus(lastTakenAt: Date | null, now: Date = new Date()): AbgStatus {
  const { hour, minute } = cairoHourMinute(now);
  const nowFraction = hour + minute / 60;

  let pastSlot: number = FIXED_ABG_HOURS[FIXED_ABG_HOURS.length - 1];
  let nextSlot: number = FIXED_ABG_HOURS[0];

  for (let i = 0; i < FIXED_ABG_HOURS.length; i++) {
    const h = FIXED_ABG_HOURS[i];
    if (nowFraction >= h) {
      pastSlot = h;
      nextSlot = i + 1 < FIXED_ABG_HOURS.length ? FIXED_ABG_HOURS[i + 1] : FIXED_ABG_HOURS[0];
    } else {
      nextSlot = h;
      break;
    }
  }

  if (!lastTakenAt) {
    return { isDue: true, text: `ABG Due (Next: ${formatSlot(nextSlot)})` };
  }

  const diffHours = (now.getTime() - lastTakenAt.getTime()) / (1000 * 60 * 60);

  if (diffHours >= 4.0) {
    return { isDue: true, text: `ABG Due (Missed ${formatSlot(pastSlot)})` };
  }
  return { isDue: false, text: `Next: ${formatSlot(nextSlot)}` };
}
