"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ClinicalRole } from "@/lib/permissions";
import { can, type Permission } from "@/lib/permissions";

interface ChartCtx {
  admissionId: string;
  /** The version this browser last loaded or produced. Sent with every guarded save. */
  version: number;
  setVersion: (v: number) => void;
  /** True when the server now has a newer version than the one on screen. */
  stale: boolean;
  reload: () => void;
  role: ClinicalRole;
  /** Discharged admissions are read only for everyone. */
  readOnly: boolean;
  allowed: (p: Permission) => boolean;
  uploadMode: "presigned" | "proxy";
}

const Ctx = createContext<ChartCtx | null>(null);

export function useChart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useChart outside ChartProvider");
  return c;
}

/**
 * Holds the chart version the user is editing against. Polling refreshes the server version; if it moves
 * ahead of the loaded one (someone else saved), a banner offers to reload and forms remount with fresh data.
 */
export function ChartProvider({
  admissionId,
  serverVersion,
  role,
  readOnly,
  uploadMode,
  children,
}: {
  admissionId: string;
  serverVersion: number;
  role: ClinicalRole;
  readOnly: boolean;
  uploadMode: "presigned" | "proxy";
  children: (api: { epoch: number }) => ReactNode;
}) {
  const [loaded, setLoaded] = useState(serverVersion);
  const [epoch, setEpoch] = useState(0);
  const stale = serverVersion > loaded;
  const value: ChartCtx = {
    admissionId,
    version: loaded,
    setVersion: setLoaded,
    stale,
    reload: () => {
      setLoaded(serverVersion);
      setEpoch((e) => e + 1);
    },
    role,
    readOnly,
    allowed: (p) => !readOnly && can(role, p),
    uploadMode,
  };
  return <Ctx.Provider value={value}>{children({ epoch })}</Ctx.Provider>;
}
