"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { FileText } from "lucide-react";
import Button from "@/components/arc/button/button";
import { patientLabel } from "@/lib/display";
import { cairoDateKey } from "@/lib/time";

/** Loads a print page in a hidden frame and opens the print dialog directly. Browsers use the frame's title as the saved file name. */
function usePrintFrame(url: string, title: string) {
  const [busy, setBusy] = useState(false);

  const print = () => {
    setBusy(true);
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    const cleanup = () => {
      window.clearTimeout(fallback);
      window.removeEventListener("afterprint", cleanup);
      frame.remove();
    };
    // afterprint does not fire reliably for a hidden frame, so the frame is also dropped after a delay.
    const fallback = window.setTimeout(cleanup, 5 * 60 * 1000);
    frame.onload = () => {
      setBusy(false);
      try {
        const win = frame.contentWindow;
        if (!win) throw new Error("no frame window");
        win.document.title = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
        window.addEventListener("afterprint", cleanup);
        win.addEventListener("afterprint", cleanup);
        win.focus();
        win.print();
      } catch {
        // The browser refused to let this page read the frame (for example it was blocked from framing), so show the print page instead.
        cleanup();
        window.open(url, "_blank");
      }
    };
    frame.src = url;
    document.body.appendChild(frame);
  };

  return { print, busy };
}

const today = () => cairoDateKey(new Date());

export function PrintCensusButton({ className }: { className: string }) {
  const { print, busy } = usePrintFrame("/print/census", `Census ${today()}`);
  return (
    <button type="button" onClick={print} disabled={busy} className={className} title="Print entire inpatient census from all floors">
      <FileText size={16} aria-hidden="true" className="shrink-0" />
      <span>{busy ? "Preparing…" : "Print all floors"}</span>
    </button>
  );
}

/** Prints one patient's chart. The file is named "<patient name> <date>". With `variant` it renders as a design-system button, otherwise as a bare text button. */
export function PrintPatientButton({ admissionId, patientName, className, title, variant, children }: { admissionId: string; patientName: string; className?: string; title?: string; variant?: ComponentProps<typeof Button>["variant"]; children: ReactNode }) {
  const { print, busy } = usePrintFrame(`/print/patient/${admissionId}`, `${patientLabel(patientName)} ${today()}`);
  if (variant) {
    return (
      <Button variant={variant} className={className} title={title} loading={busy} onClick={print}>
        {children}
      </Button>
    );
  }
  return (
    <button type="button" onClick={print} disabled={busy} className={className} title={title}>
      {busy ? "Preparing…" : children}
    </button>
  );
}
