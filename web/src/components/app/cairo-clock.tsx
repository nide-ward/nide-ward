"use client";

import { useEffect, useState } from "react";
import { CAIRO_TZ } from "@/lib/clinical/schedule";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAIRO_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Cairo wall clock. Renders nothing until mounted so server and client markup match. */
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
    <span className={`tnum ${className}`} aria-label="Cairo time">
      {now ? `${fmt.format(now)} Cairo` : " "}
    </span>
  );
}
