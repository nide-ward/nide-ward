"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import Button from "@/components/arc/button/button";
import {
  clearOfflineQueue,
  flushOfflineQueue,
  getOfflineQueue,
  subscribeSyncStatus,
  type QueuedAction,
  type SyncState,
} from "@/lib/offline-sync";

function formatCairoTime(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "Recent";
  }
}

export function SyncStatusPill() {
  const [state, setState] = useState<SyncState>({
    status: "online",
    pendingCount: 0,
    lastSaved: null,
    isFlushing: false,
  });
  const [openModal, setOpenModal] = useState(false);
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    return subscribeSyncStatus((s) => {
      setState(s);
      setQueue(getOfflineQueue());
    });
  }, []);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await flushOfflineQueue();
      setQueue(getOfflineQueue());
    } finally {
      setIsManualSyncing(false);
    }
  };

  const isOffline = state.status === "offline";
  const isSyncing = state.status === "connecting" || state.isFlushing || isManualSyncing;

  const statusLabel = isOffline
    ? "Offline — hospital network and sync status"
    : isSyncing
    ? "Syncing — hospital network and sync status"
    : "Online — hospital network and sync status";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQueue(getOfflineQueue());
          setOpenModal(true);
        }}
        className={`group inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium whitespace-nowrap transition cursor-pointer touch-manipulation sm:h-8 sm:min-w-0 sm:rounded-lg ${
          isOffline
            ? "bg-rose-950/80 border-rose-800 text-rose-200 hover:bg-rose-900"
            : isSyncing
            ? "bg-amber-950/80 border-amber-800 text-amber-200 hover:bg-amber-900"
            : "bg-topbar-control border-topbar-border text-topbar-ink hover:text-topbar-strong"
        }`}
        title="Hospital network and offline sync status"
        aria-label={statusLabel}
      >
        {isOffline ? (
          <>
            <WifiOff size={16} aria-hidden="true" className="shrink-0 text-rose-400 sm:hidden" />
            <span aria-hidden="true" className="hidden size-2 shrink-0 rounded-full bg-rose-500 animate-pulse sm:inline-block" />
            <span className="hidden sm:inline font-semibold">Offline</span>
            {state.pendingCount > 0 && (
              <span className="tnum rounded bg-rose-600/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {state.pendingCount}
              </span>
            )}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw size={15} aria-hidden="true" className="shrink-0 animate-spin text-amber-400 sm:size-3" />
            <span className="hidden sm:inline font-semibold">Syncing...</span>
            {state.pendingCount > 0 && (
              <span className="tnum rounded bg-amber-600/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {state.pendingCount}
              </span>
            )}
          </>
        ) : (
          <>
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-emerald-400 sm:size-2" />
            <span className="hidden md:inline">Online</span>
            {state.lastSaved && (
              <span className="tnum hidden lg:inline text-[11px] opacity-75">
                • {formatCairoTime(state.lastSaved)}
              </span>
            )}
            {state.pendingCount > 0 && (
              <span className="tnum rounded bg-amber-500/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                {state.pendingCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Sync Status Details Modal */}
      {openModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 text-foreground"
          onClick={() => setOpenModal(false)}
        >
          <div
            className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl bg-surface border border-border p-4 sm:p-5 shadow-xl space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex min-w-0 items-center gap-2">
                {isOffline ? (
                  <WifiOff size={18} className="shrink-0 text-rose-500" />
                ) : (
                  <Wifi size={18} className="shrink-0 text-emerald-500" />
                )}
                <h3 className="truncate font-bold text-sm text-foreground">
                  Hospital Network & Offline Sync
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                aria-label="Close sync status"
                className="inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-lg text-text-secondary hover:bg-surface-muted hover:text-foreground font-bold sm:size-8"
              >
                ✕
              </button>
            </div>

            {/* Current State Details */}
            <div className="space-y-2">
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  isOffline
                    ? "bg-hue-rose-soft border-hue-rose-line text-hue-rose-ink"
                    : "bg-hue-emerald-soft border-hue-emerald-line text-hue-emerald-ink"
                }`}
              >
                {isOffline ? (
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-hue-rose" />
                ) : (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-hue-emerald" />
                )}
                <div className="min-w-0 space-y-0.5">
                  <p className="font-bold text-xs">
                    {isOffline
                      ? "Offline (Weak / No Reception)"
                      : "Connected to NIDE Hospital Server"}
                  </p>
                  <p className="text-[11px] opacity-85">
                    {isOffline
                      ? "Bad signal detected on the ward. All edits, admits, and plan updates are saved locally to this device and will automatically upload once signal returns."
                      : "Real-time synchronization active. All patient updates are in sync."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="min-w-0 p-2.5 rounded-lg bg-surface-muted border border-border">
                  <span className="text-text-secondary block">Last Saved Locally:</span>
                  <b className="tnum text-foreground font-mono">{formatCairoTime(state.lastSaved)}</b>
                </div>
                <div className="min-w-0 p-2.5 rounded-lg bg-surface-muted border border-border">
                  <span className="text-text-secondary block">Pending Queue:</span>
                  <b
                    className={`tnum font-mono ${
                      state.pendingCount > 0 ? "text-amber-500 font-bold" : "text-foreground"
                    }`}
                  >
                    {state.pendingCount} update{state.pendingCount === 1 ? "" : "s"}
                  </b>
                </div>
              </div>
            </div>

            {/* Pending Items List */}
            <div>
              <span className="font-bold text-[11px] uppercase tracking-wider text-text-secondary block mb-1.5">
                Queued Offline Actions ({queue.length})
              </span>
              {queue.length === 0 ? (
                <p className="p-3 bg-surface-muted/50 rounded-lg text-text-secondary text-center text-[11px]">
                  ✓ No pending changes. Your device is fully in sync with the server.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {queue.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-lg bg-surface-muted border border-border flex items-center justify-between text-[11px]"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold block truncate text-foreground">
                          {item.description}
                        </span>
                        <span className="tnum text-[10px] text-text-secondary">
                          {formatCairoTime(item.timestamp)}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] bg-hue-amber-soft text-hue-amber-ink border border-hue-amber-line px-1.5 py-0.5 rounded font-medium">
                        Queued
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
              {queue.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    clearOfflineQueue();
                    setQueue([]);
                  }}
                  className="inline-flex min-h-11 touch-manipulation items-center px-2 text-xs text-hue-rose-ink hover:underline sm:min-h-8 sm:text-[11px]"
                >
                  Clear queue
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={isSyncing}
                  disabled={isOffline && queue.length === 0}
                  onClick={() => void handleManualSync()}
                >
                  {isSyncing ? "Syncing..." : "Sync Now"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpenModal(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
