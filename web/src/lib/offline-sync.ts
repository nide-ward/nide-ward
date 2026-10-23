"use client";

import {
  admitPatient,
  dischargePatient,
  recordBedside,
  updateChart,
  saveInsulin,
  addMedication,
  removeMedication,
} from "@/server/actions/patients";
import { addAbgReading, deleteAbgReading } from "@/server/actions/abg";
import { saveRoster } from "@/server/actions/roster";

export type SyncStatus = "online" | "connecting" | "offline" | "saving";

export type OfflineActionType =
  | "admitPatient"
  | "updateChart"
  | "recordBedside"
  | "addAbgReading"
  | "deleteAbgReading"
  | "saveInsulin"
  | "addMedication"
  | "removeMedication"
  | "dischargePatient"
  | "saveRoster";

export interface QueuedAction {
  id: string;
  type: OfflineActionType;
  payload: any;
  description: string;
  timestamp: string;
  retryCount: number;
}

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSaved: string | null;
  isFlushing: boolean;
}

const QUEUE_KEY = "ward_offline_queue_v2";
const LAST_SAVED_KEY = "ward_last_saved_time_v2";

let isCurrentlyFlushing = false;
const listeners = new Set<(state: SyncState) => void>();

export function getOfflineQueue(): QueuedAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedAction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    notifyListeners();
  } catch (e) {
    console.error("Failed to save offline queue to localStorage", e);
  }
}

export function getLastSavedTime(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SAVED_KEY);
}

export function setLastSavedTime(isoString?: string): void {
  if (typeof window === "undefined") return;
  const time = isoString || new Date().toISOString();
  try {
    localStorage.setItem(LAST_SAVED_KEY, time);
    notifyListeners();
  } catch {}
}

export function enqueueOfflineAction(
  type: OfflineActionType,
  payload: any,
  description: string,
): QueuedAction {
  const queue = getOfflineQueue();
  const item: QueuedAction = {
    id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    description: description || type,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };
  queue.push(item);
  saveOfflineQueue(queue);
  setLastSavedTime();
  notifyToast("Saved locally (Offline)", `${item.description} queued to upload when reception returns.`);
  return item;
}

export function removeOfflineAction(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  saveOfflineQueue(queue);
}

export function clearOfflineQueue(): void {
  saveOfflineQueue([]);
}

export function getPendingCount(): number {
  return getOfflineQueue().length;
}

export function getSyncStatus(): SyncStatus {
  if (typeof window === "undefined") return "online";
  if (!navigator.onLine) return "offline";
  if (isCurrentlyFlushing) return "connecting";
  return "online";
}

export function getCurrentSyncState(): SyncState {
  return {
    status: getSyncStatus(),
    pendingCount: getPendingCount(),
    lastSaved: getLastSavedTime(),
    isFlushing: isCurrentlyFlushing,
  };
}

function notifyListeners(): void {
  const state = getCurrentSyncState();
  listeners.forEach((fn) => fn(state));
}

export function subscribeSyncStatus(fn: (state: SyncState) => void): () => void {
  listeners.add(fn);
  fn(getCurrentSyncState());
  return () => {
    listeners.delete(fn);
  };
}

export function notifyToast(title: string, description?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ward:toast", { detail: { title, description } }));
}

/**
 * Executes a single queued action using the appropriate server action.
 */
async function executeAction(item: QueuedAction): Promise<boolean> {
  try {
    let res: { ok: boolean; error?: string } = { ok: false };
    switch (item.type) {
      case "admitPatient":
        res = await admitPatient(item.payload);
        break;
      case "updateChart":
        res = await updateChart(item.payload);
        break;
      case "recordBedside":
        res = await recordBedside(item.payload);
        break;
      case "addAbgReading":
        res = await addAbgReading(item.payload);
        break;
      case "deleteAbgReading":
        res = await deleteAbgReading(item.payload);
        break;
      case "saveInsulin":
        res = await saveInsulin(item.payload);
        break;
      case "addMedication":
        res = await addMedication(item.payload);
        break;
      case "removeMedication":
        res = await removeMedication(item.payload);
        break;
      case "dischargePatient":
        res = await dischargePatient(item.payload);
        break;
      case "saveRoster":
        res = await saveRoster(item.payload);
        break;
      default:
        console.warn("Unknown offline action type:", item.type);
        return true; // remove unhandled
    }

    if (res.ok) {
      return true;
    } else {
      console.warn(`Offline action ${item.type} rejected by server:`, res.error);
      // If validation error or conflict, do not block the queue permanently
      return true;
    }
  } catch (err: any) {
    // Check if network error (still offline)
    const msg = String(err?.message || err);
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("NetworkError") || !navigator.onLine) {
      throw new Error("Network still unavailable");
    }
    console.error("Non-network error during offline action replay:", err);
    return true; // Drop to prevent infinite blocking
  }
}

/**
 * Flushes all pending actions in order when reconnected.
 */
export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (typeof window === "undefined" || isCurrentlyFlushing) {
    return { synced: 0, failed: 0 };
  }
  if (!navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  isCurrentlyFlushing = true;
  notifyListeners();

  let synced = 0;
  let failed = 0;

  try {
    for (const item of [...queue]) {
      try {
        const done = await executeAction(item);
        if (done) {
          removeOfflineAction(item.id);
          synced++;
          setLastSavedTime();
        }
      } catch {
        // Network connection dropped midway
        failed++;
        break;
      }
    }
  } finally {
    isCurrentlyFlushing = false;
    notifyListeners();
  }

  if (synced > 0) {
    notifyToast(
      "✓ All offline changes uploaded",
      `${synced} pending hospital update${synced > 1 ? "s" : ""} synced to the server.`,
    );
    window.dispatchEvent(new CustomEvent("ward:synced"));
  }

  return { synced, failed };
}

// Attach automatic browser listeners
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    notifyToast("Connection Restored", "Uploading pending hospital data to server...");
    void flushOfflineQueue();
  });

  window.addEventListener("offline", () => {
    notifyToast("Offline Mode", "Bad reception detected. New admissions & edits will be saved locally.");
    notifyListeners();
  });

  // Background check every 30 seconds
  setInterval(() => {
    if (navigator.onLine && getPendingCount() > 0 && !isCurrentlyFlushing) {
      void flushOfflineQueue();
    }
  }, 30000);
}
