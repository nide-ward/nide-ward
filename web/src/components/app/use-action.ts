"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/action";
import { enqueueOfflineAction, setLastSavedTime, type OfflineActionType } from "@/lib/offline-sync";

export interface OfflineRunOptions<T = any> {
  type: OfflineActionType;
  payload: any;
  description: string;
  optimisticResult?: T;
}

/**
 * Runs a server action, tracks pending/error state for inline display, and refreshes the
 * server components on success. Supports offline fallback and optimistic queueing when
 * the hospital network connection is weak or unavailable.
 */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const run = useCallback(
    async <T,>(
      fn: () => Promise<ActionResult<T>>,
      onOk?: (data: T) => void,
      offlineOptions?: OfflineRunOptions<T>,
    ): Promise<boolean> => {
      setPending(true);
      setError(null);
      setConflict(false);

      // 1. If currently offline and an offline fallback is provided, queue immediately
      if (typeof navigator !== "undefined" && !navigator.onLine && offlineOptions) {
        enqueueOfflineAction(offlineOptions.type, offlineOptions.payload, offlineOptions.description);
        setLastSavedTime();
        if (offlineOptions.optimisticResult !== undefined) {
          onOk?.(offlineOptions.optimisticResult);
        }
        setPending(false);
        return true;
      }

      try {
        const res = await fn();
        if (res.ok) {
          setLastSavedTime();
          onOk?.(res.data);
          if (typeof navigator === "undefined" || navigator.onLine) {
            router.refresh();
          }
          return true;
        }
        setError(res.error);
        setConflict(res.code === "conflict");
        if (res.code === "unauthenticated") router.push("/login");
        return false;
      } catch (err: any) {
        // 2. Network drop during request execution -> queue offline if supported
        const isNetworkErr =
          (typeof navigator !== "undefined" && !navigator.onLine) ||
          String(err?.message || err).toLowerCase().includes("fetch") ||
          String(err?.message || err).toLowerCase().includes("network");

        if (isNetworkErr && offlineOptions) {
          enqueueOfflineAction(offlineOptions.type, offlineOptions.payload, offlineOptions.description);
          setLastSavedTime();
          if (offlineOptions.optimisticResult !== undefined) {
            onOk?.(offlineOptions.optimisticResult);
          }
          return true;
        }

        setError("Could not reach the server. Bad reception detected. Check your connection or retry.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { run, pending, error, conflict, clearError: () => setError(null) };
}
