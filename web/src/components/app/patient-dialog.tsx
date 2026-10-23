"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { getAdmissionDetailAction } from "@/server/actions/patients";
import type { AdmissionDetail } from "@/server/queries";
import type { ClinicalRole } from "@/lib/permissions";
import { ChartView } from "./chart-view";

interface PatientDialogProps {
  admissionId: string | null;
  role: ClinicalRole;
  uploadMode?: "presigned" | "proxy";
  onClose: () => void;
}

export function PatientDialog({
  admissionId,
  role,
  uploadMode = "proxy",
  onClose,
}: PatientDialogProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<AdmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admissionId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getAdmissionDetailAction(admissionId)
      .then((res) => {
        if (!active) return;
        if (!res?.detail) {
          setError("Patient record could not be loaded.");
        } else {
          setDetail(res.detail);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load patient chart.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [admissionId]);

  const handleClose = () => {
    onClose();
    router.refresh();
  };

  const a = detail?.admission;
  const reg = detail?.regimen;

  return (
    <Dialog open={admissionId !== null} onOpenChange={(open) => !open && handleClose()}>
      {admissionId && (
        <DialogContent
          className="patient-dialog"
          title={detail ? `${detail.ward.title} • ${detail.bed.name}` : "Patient Chart"}
          description={
            detail
              ? `${detail.admission.patientName || "Unnamed Patient"} (${detail.admission.age ? `${detail.admission.age} yrs` : "--"})`
              : "Loading patient clinical record..."
          }
        >
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-text-secondary">
              <Loader2 className="size-8 animate-spin text-teal-600" />
              <p className="text-sm font-medium">Loading patient clinical chart...</p>
            </div>
          )}

          {error && (
            <div className="p-6 text-center space-y-3">
              <p className="text-rose-600 font-semibold">{error}</p>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-surface border border-border rounded-xl text-sm font-semibold hover:bg-surface-muted"
              >
                Close
              </button>
            </div>
          )}

          {!loading && !error && detail && a && (
            <ChartView
              admissionId={a.id}
              serverVersion={a.version}
              role={role}
              uploadMode={uploadMode}
              nowIso={new Date().toISOString()}
              bedName={detail.bed.name}
              wardTitle={detail.ward.title}
              wardId={detail.ward.id}
              discharged={
                a.status === "discharged" && a.dischargedAt
                  ? {
                      at: new Date(a.dischargedAt),
                      by: a.dischargedBy ?? "",
                      outcome: a.dischargeOutcome ?? "",
                      notes: a.dischargeNotes ?? "",
                      attending: a.attendingAtDischarge ?? "",
                    }
                  : null
              }
              overview={{
                patientName: a.patientName,
                age: a.age,
                admittedAt: a.admittedAt ? new Date(a.admittedAt) : new Date(),
                diagnosis: a.diagnosis,
                riskFactors: a.riskFactors,
                labsImaging: a.labsImaging,
                consultations: a.consultations,
                followupPlan: a.followupPlan,
                urineAcetone: a.urineAcetone,
                currentRbg: a.currentRbg,
              }}
              abgs={detail.abgs.map((r) => ({
                ...r,
                takenAt: new Date(r.takenAt),
                createdAt: new Date(r.createdAt),
              }))}
              insulin={{
                basalUnits: reg?.basalUnits ?? 0,
                breakfastUnits: reg?.breakfastUnits ?? 0,
                lunchUnits: reg?.lunchUnits ?? 0,
                dinnerUnits: reg?.dinnerUnits ?? 0,
                basalLabel: reg?.basalLabel ?? "Lantus (Glargine) at 11:00 PM",
                updatedBy: reg?.updatedBy ?? "n/a",
              }}
              meds={detail.meds.map((m) => ({ id: m.id, name: m.name, dose: m.dose, frequency: m.frequency }))}
              media={detail.media.map((m) => ({
                id: m.id,
                originalName: m.originalName,
                uploadedBy: m.uploadedBy,
                createdAt: new Date(m.createdAt),
              }))}
            />
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
