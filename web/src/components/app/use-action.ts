"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/server/action";

/**
 * Runs a server action, tracks pending/error state for inline display, and refreshes the
 * server components on success. Foreground actions confirm in place; errors stay visible.
 */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const run = useCallback(
    async <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (data: T) => void): Promise<boolean> => {
      setPending(true);
      setError(null);
      setConflict(false);
      try {
        const res = await fn();
        if (res.ok) {
          onOk?.(res.data);
          router.refresh();
          return true;
        }
        setError(res.error);
        setConflict(res.code === "conflict");
        if (res.code === "unauthenticated") router.push("/login");
        return false;
      } catch {
        setError("Could not reach the server. Check the connection and try again.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { run, pending, error, conflict, clearError: () => setError(null) };
}
