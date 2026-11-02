"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import Button from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/arc/dialog/dialog";
import HoldToConfirm from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { Select } from "@/components/arc/select/select";
import { Textarea } from "@/components/arc/textarea/textarea";
import { dischargePatient, getFreeBedsAction, transferPatient } from "@/server/actions/patients";
import type { FreeBedWard } from "@/server/queries";
import { patientLabel } from "@/lib/display";
import { useChart } from "./chart-context";
import { useAction } from "./use-action";
import { InlineError } from "./ui";
import { useToast } from "./toast-provider";

const ICU = "icu";

/** Moves the patient to a free bed on any floor, or out of the ward to the ICU (which archives the record). */
export function TransferDialog({ patientName, bedName, wardId, className }: { patientName: string; bedName: string; wardId: string; className?: string }) {
  const chart = useChart();
  const who = patientLabel(patientName, bedName);
  const router = useRouter();
  const { toast } = useToast();
  const { run, error, conflict } = useAction();
  const [open, setOpen] = useState(false);
  const [floors, setFloors] = useState<FreeBedWard[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [destination, setDestination] = useState("");
  const [bedId, setBedId] = useState("");
  const [notes, setNotes] = useState("");

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setFloors(null);
    setLoadError(false);
    setDestination("");
    setBedId("");
    // A patient moves to a different floor, so the one they are already on is not offered.
    getFreeBedsAction().then((all) => setFloors(all.filter((f) => f.id !== wardId)), () => setLoadError(true));
  };

  if (!chart.allowed("patient.transfer") && !chart.allowed("patient.discharge")) return null;

  const floor = floors?.find((f) => f.id === destination);
  const toIcu = destination === ICU;
  const done = () => (chart.onDischarged ? chart.onDischarged() : router.push("/"));

  const moveToBed = () => {
    const payload = { admissionId: chart.admissionId, version: chart.version, bedId };
    void run(
      () => transferPatient(payload),
      (r) => {
        toast(`Moved ${who}`, `${r.wardTitle}, ${r.bedName}`);
        done();
      },
      { type: "transferPatient", payload, description: `Move ${patientName || "patient"} to another bed` },
    );
  };

  const options = [
    ...(floors ?? []).map((f) => ({ value: f.id, label: `${f.title} (${f.beds.length} free)` })),
    { value: ICU, label: "ICU / Critical Care" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className={className}>
          <ArrowRightLeft size={15} className="mr-1 inline" aria-hidden="true" />
          Transfer
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sheet-form-dialog"
        title="Transfer patient"
        description={`${who}${patientName.trim() ? `, ${bedName}` : ""}. Move to a free bed on another floor, or transfer to the ICU.`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain grid content-start gap-4 p-4 sm:p-6">
          <Select
            label="Transfer to"
            value={destination}
            onValueChange={(v) => {
              setDestination(v);
              setBedId("");
            }}
            options={options}
            placeholder={floors || loadError ? "Choose a floor or the ICU" : "Loading floors…"}
            disabled={!floors && !loadError}
          />
          {loadError && <p className="text-xs text-text-secondary">Free beds could not be loaded. You can still transfer to the ICU.</p>}
          {floor && (
            <Select
              label="Bed"
              value={bedId}
              onValueChange={setBedId}
              options={floor.beds.map((b) => ({ value: b.id, label: b.name }))}
              placeholder="Choose a free bed"
            />
          )}
          {toIcu && (
            <>
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-text-secondary">
                <b>Deterioration Transfer:</b> Patient will be archived with disposition <b>&ldquo;Transferred to ICU / Critical Care&rdquo;</b> and the bed becomes available.
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
            </>
          )}
          <InlineError>{error}</InlineError>
          {conflict && (
            <Button variant="secondary" onClick={() => router.refresh()}>
              Reload chart
            </Button>
          )}
        </div>
        <div className="flex-none grid gap-2 border-t border-border bg-surface-raised pt-3 pb-[calc(0.75rem+var(--dialog-safe-bottom,env(safe-area-inset-bottom)))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:pb-4">
          {toIcu && chart.allowed("patient.discharge") && (
            <HoldToConfirm
              tone="danger"
              label="Hold to confirm ICU transfer"
              confirmedLabel="Transferred"
              onConfirm={() => {
                const payload = {
                  admissionId: chart.admissionId,
                  version: chart.version,
                  outcome: "Transferred to ICU / Critical Care" as const,
                  notes,
                };
                void run(
                  () => dischargePatient(payload),
                  () => {
                    toast(`Transferred ${who} to ICU`, "Recorded in archive");
                    done();
                  },
                  { type: "dischargePatient", payload, description: `Transfer to ICU: ${patientName || "Patient"}` },
                );
              }}
            />
          )}
          {floor && (
            <Button disabled={!bedId} onClick={moveToBed}>
              Move patient
            </Button>
          )}
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
