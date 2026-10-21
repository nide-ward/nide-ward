"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Live updates by polling: re-runs the server components every ~10 s while the tab is visible,
 * and immediately when the tab becomes visible again. No websockets.
 */
export function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);
  return null;
}
