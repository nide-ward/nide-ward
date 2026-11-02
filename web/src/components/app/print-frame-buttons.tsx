"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { FileText } from "lucide-react";
import Button from "@/components/arc/button/button";
import { useToast } from "@/components/app/toast-provider";
import { patientLabel } from "@/lib/display";
import { downloadPrintPdf } from "@/lib/print-pdf";
import { cairoDateKey } from "@/lib/time";

/** Renders a print page to a PDF and downloads it straight to the device. The file is named after `title`. */
function usePdfDownload(url: string, title: string) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const print = async () => {
    setBusy(true);
    try {
      await downloadPrintPdf(url, title);
    } catch {
      toast("Could not create the PDF", "Try again");
    } finally {
      setBusy(false);
    }
  };

  return { print, busy };
}

const today = () => cairoDateKey(new Date());

export function PrintCensusButton({ className }: { className: string }) {
  const { print, busy } = usePdfDownload("/print/census", `Census ${today()}`);
  return (
    <button type="button" onClick={print} disabled={busy} className={className} title="Download the entire inpatient census from all floors as a PDF">
      <FileText size={16} aria-hidden="true" className="shrink-0" />
      <span>{busy ? "Preparing…" : "Print all floors"}</span>
    </button>
  );
}

/** Downloads one patient's chart as a PDF. The file is named "<patient name> <date>". With `variant` it renders as a design-system button, otherwise as a bare text button. */
export function PrintPatientButton({ admissionId, patientName, className, title, variant, children }: { admissionId: string; patientName: string; className?: string; title?: string; variant?: ComponentProps<typeof Button>["variant"]; children: ReactNode }) {
  const { print, busy } = usePdfDownload(`/print/patient/${admissionId}`, `${patientLabel(patientName)} ${today()}`);
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
