"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import Toast from "@/components/arc/toast/toast";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
}

const ToastContext = createContext<{ toast: (title: string, description?: string) => void }>({ toast: () => {} });

/** Background confirmations only. Foreground actions confirm in place (button state, inline message). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((title: string, description?: string) => {
    setItems((list) => [...list.slice(-2), { id: Date.now() + Math.random(), title, description }]);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast
              title={t.title}
              description={t.description}
              onOpenChange={(open) => {
                if (!open) setItems((list) => list.filter((x) => x.id !== t.id));
              }}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
