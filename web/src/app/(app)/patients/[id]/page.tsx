import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { ChartView } from "@/components/app/chart-view";
import { uploadMode } from "@/lib/env";
import { requireStaff } from "@/lib/session";
import { getAdmissionDetail } from "@/server/queries";

export const metadata = { title: "Patient chart" };
export const dynamic = "force-dynamic";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    await requireStaff();
    notFound();
  }
  const [staff, d] = await Promise.all([requireStaff(), getAdmissionDetail(id)]);
  if (!d) notFound();
  const a = d.admission;
  const reg = d.regimen;

  return (
    <>
      {a.status === "active" && <AutoRefresh intervalMs={10000} />}
      <ChartView
        admissionId={a.id}
        serverVersion={a.version}
        role={staff.role}
        uploadMode={uploadMode()}
        nowIso={new Date().toISOString()}
        bedName={d.bed.name}
        wardTitle={d.ward.title}
        wardId={d.ward.id}
        discharged={
          a.status === "discharged" && a.dischargedAt
            ? { at: a.dischargedAt, by: a.dischargedBy ?? "", outcome: a.dischargeOutcome ?? "", notes: a.dischargeNotes ?? "", attending: a.attendingAtDischarge ?? "" }
            : null
        }
        overview={{
          patientName: a.patientName,
          age: a.age,
          admittedAt: a.admittedAt,
          diagnosis: a.diagnosis,
          riskFactors: a.riskFactors,
          labsImaging: a.labsImaging,
          consultations: a.consultations,
          followupPlan: a.followupPlan,
          urineAcetone: a.urineAcetone,
          currentRbg: a.currentRbg,
        }}
        abgs={d.abgs.map((r) => ({ ...r }))}
        insulin={{
          basalUnits: reg?.basalUnits ?? 0,
          breakfastUnits: reg?.breakfastUnits ?? 0,
          lunchUnits: reg?.lunchUnits ?? 0,
          dinnerUnits: reg?.dinnerUnits ?? 0,
          basalLabel: reg?.basalLabel ?? "Lantus (Glargine) at 11:00 PM",
          updatedBy: reg?.updatedBy ?? "n/a",
        }}
        meds={d.meds.map((m) => ({ id: m.id, name: m.name, dose: m.dose, frequency: m.frequency }))}
        media={d.media.map((m) => ({ id: m.id, originalName: m.originalName, uploadedBy: m.uploadedBy, createdAt: m.createdAt }))}
      />
    </>
  );
}
