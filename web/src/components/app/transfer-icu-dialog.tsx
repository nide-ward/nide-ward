"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import Button from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/arc/dialog/dialog";
import HoldToConfirm from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { Textarea } from "@/components/arc/textarea/textarea";
import { dischargePatient } from "@/server/actions/patients";
import { patientLabel } from "@/lib/display";
import { useChart } from "./chart-context";
import { useAction } from "./use-action";
import { InlineError } from "./ui";
import { useToast } from "./toast-provider";

export function TransferToIcuDialog({ patientName, bedName }: { patientName: string; bedName: string }) {
  const chart = useChart();
  const who = patientLabel(patientName, bedName);
  const router = useRouter();
  const { toast } = useToast();
  const { run, error, conflict } = useAction();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");

  if (!chart.allowed("patient.discharge")) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="cursor-pointer border-warning text-text-secondary hover:bg-surface-muted">
          <AlertTriangle size={15} className="mr-1 inline text-warning" aria-hidden="true" />
          Transfer to ICU
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sheet-form-dialog"
        title="Transfer Patient to ICU"
        description={`${who}${patientName.trim() ? `, ${bedName}` : ""}. Transfer patient due to clinical deterioration. The admission record moves to the archive under ICU transfer and the bed becomes available.`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain grid content-start gap-4 p-4 sm:p-6">
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-text-secondary">
            <b>Deterioration Transfer:</b> Patient will be archived with disposition <b>&ldquo;Transferred to ICU / Critical Care&rdquo;</b>.
          </div>
          <Textarea
            label="ICU Transfer Reason / Clinical Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={3000}
            placeholder="e.g. Refractory metabolic acidosis, hemodynamic instability, altered conscious level, persistent vomiting."
            description="Document deterioration triggers, vitals at transfer, and receiving ICU physician."
          />
          <InlineError>{error}</InlineError>
          {conflict && (
            <Button variant="secondary" onClick={() => router.refresh()}>
              Reload chart
            </Button>
          )}
        </div>
        <div className="flex-none grid gap-2 border-t border-border bg-surface-raised pt-3 pb-[calc(0.75rem+var(--dialog-safe-bottom,env(safe-area-inset-bottom)))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:pb-4">
          <HoldToConfirm
            tone="danger"
            label="Hold to confirm ICU transfer"
            confirmedLabel="Transferred"
            onConfirm={() => {
              const transferPayload = {
                admissionId: chart.admissionId,
                version: chart.version,
                outcome: "Transferred to ICU / Critical Care" as const,
                notes,
              };
              void run(
                () => dischargePatient(transferPayload),
                () => {
                  toast(`Transferred ${who} to ICU`, "Recorded in archive");
                  if (chart.onDischarged) {
                    chart.onDischarged();
                  } else {
                    router.push("/");
                  }
                },
                {
                  type: "dischargePatient",
                  payload: transferPayload,
                  description: `Transfer to ICU: ${patientName || "Patient"}`,
                },
              );
            }}
          />
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
