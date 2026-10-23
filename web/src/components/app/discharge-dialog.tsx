"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/arc/dialog/dialog";
import HoldToConfirm from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { Select } from "@/components/arc/select/select";
import { Textarea } from "@/components/arc/textarea/textarea";
import { dischargePatient } from "@/server/actions/patients";
import { DISCHARGE_OUTCOMES } from "@/lib/validation";
import { patientLabel } from "@/lib/display";
import { useChart } from "./chart-context";
import { useAction } from "./use-action";
import { InlineError } from "./ui";
import { useToast } from "./toast-provider";

export function DischargeDialog({ patientName, bedName }: { patientName: string; bedName: string }) {
  const chart = useChart();
  const who = patientLabel(patientName, bedName);
  const router = useRouter();
  const { toast } = useToast();
  const { run, error, conflict } = useAction();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<string>(DISCHARGE_OUTCOMES[0]);
  const [notes, setNotes] = useState("");

  if (!chart.allowed("patient.discharge")) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger">Discharge patient</Button>
      </DialogTrigger>
      <DialogContent
        className="sheet-form-dialog"
        title="Discharge patient"
        description={`${who}${patientName.trim() ? `, ${bedName}` : ""}. The full record moves to the archive and the bed becomes available.`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain grid content-start gap-4 p-4 sm:p-6">
          <Select label="Outcome" options={DISCHARGE_OUTCOMES.map((o) => ({ value: o, label: o }))} value={outcome} onValueChange={setOutcome} />
          <Textarea label="Discharge notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={3000} description="Condition at discharge, prescriptions, follow-up clinic." />
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
            label="Hold to discharge"
            confirmedLabel="Discharged"
            onConfirm={() => {
              const disPayload = { admissionId: chart.admissionId, version: chart.version, outcome, notes };
              void run(
                () => dischargePatient(disPayload),
                () => {
                  toast(`Discharged ${who}`, "Preserved in the archive");
                  if (chart.onDischarged) {
                    chart.onDischarged();
                  } else {
                    router.push("/");
                  }
                },
                {
                  type: "dischargePatient",
                  payload: disPayload,
                  description: `Discharge ${who}`,
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
