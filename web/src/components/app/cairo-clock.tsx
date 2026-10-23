"use client";

import { useEffect, useState } from "react";
import { CAIRO_TZ } from "@/lib/clinical/schedule";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAIRO_TZ,
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Cairo wall clock. Reserves full width before mount so hydration and ticks never shift the bar. */
export function CairoClock({ className = "text-text-secondary" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  return (
    <span className={`tnum shrink-0 whitespace-nowrap ${className}`} aria-label="Cairo time">
      <span className="inline-grid items-center">
        <span aria-hidden="true" className="invisible select-none [grid-area:1/1]">
          Wed, 00 Sep, 00:00 Cairo
        </span>
        <span className="text-right [grid-area:1/1]">{now ? `${fmt.format(now)} Cairo` : "\u00a0"}</span>
      </span>
    </span>
  );
}
