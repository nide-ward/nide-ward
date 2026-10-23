"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle, Wifi, WifiOff } from "lucide-react";
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

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQueue(getOfflineQueue());
          setOpenModal(true);
        }}
        className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer touch-manipulation border ${
          isOffline
            ? "bg-rose-950/80 border-rose-800 text-rose-200 hover:bg-rose-900"
            : isSyncing
            ? "bg-amber-950/80 border-amber-800 text-amber-200 hover:bg-amber-900"
            : "bg-surface-elevated/70 border-topbar-ink/20 text-topbar-ink hover:text-topbar-strong"
        }`}
        title="Hospital network and offline sync status"
        aria-label="Network and offline sync status"
      >
        {isOffline ? (
          <>
            <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="hidden sm:inline font-semibold">Offline</span>
            <span className="sm:hidden font-semibold">Offline</span>
            {state.pendingCount > 0 && (
              <span className="rounded bg-rose-600/70 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {state.pendingCount}
              </span>
            )}
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw size={12} className="animate-spin text-amber-400" />
            <span className="hidden sm:inline font-semibold">Syncing...</span>
            <span className="sm:hidden font-semibold">Syncing</span>
            {state.pendingCount > 0 && (
              <span className="rounded bg-amber-600/70 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {state.pendingCount}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="hidden md:inline">Online</span>
            {state.lastSaved && (
              <span className="hidden lg:inline text-[11px] opacity-75">
                • {formatCairoTime(state.lastSaved)}
              </span>
            )}
            {state.pendingCount > 0 && (
              <span className="rounded bg-amber-500/80 px-1.5 py-0.2 text-[10px] font-bold text-slate-950">
                {state.pendingCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Sync Status Details Modal */}
      {openModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 text-text-primary"
          onClick={() => setOpenModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-surface border border-border p-5 shadow-xl space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                {isOffline ? (
                  <WifiOff size={18} className="text-rose-500" />
                ) : (
                  <Wifi size={18} className="text-emerald-500" />
                )}
                <h3 className="font-bold text-sm text-text-strong">
                  Hospital Network & Offline Sync
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="text-text-secondary hover:text-text-strong font-bold px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            {/* Current State Details */}
            <div className="space-y-2">
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  isOffline
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                }`}
              >
                {isOffline ? (
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                ) : (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                )}
                <div className="space-y-0.5">
                  <p className="font-bold text-xs">
                    {isOffline
                      ? "Offline (Weak / No Reception)"
                      : "Connected to NIDE Hospital Server"}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {isOffline
                      ? "Bad signal detected on the ward. All edits, admits, and plan updates are saved locally to this device and will automatically upload once signal returns."
                      : "Real-time synchronization active. All patient updates are in sync."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-surface-muted border border-border">
                  <span className="text-text-secondary block">Last Saved Locally:</span>
                  <b className="text-text-strong font-mono">{formatCairoTime(state.lastSaved)}</b>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-muted border border-border">
                  <span className="text-text-secondary block">Pending Queue:</span>
                  <b
                    className={`font-mono ${
                      state.pendingCount > 0 ? "text-amber-500 font-bold" : "text-text-strong"
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
                        <span className="font-semibold block truncate text-text-strong">
                          {item.description}
                        </span>
                        <span className="text-[10px] text-text-secondary">
                          {formatCairoTime(item.timestamp)}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-medium">
                        Queued
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              {queue.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    clearOfflineQueue();
                    setQueue([]);
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 underline"
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
