import { NO_DIAGNOSIS, ageShort, isBlank, patientLabel } from "@/lib/display";
import { analyzeABG } from "@/lib/clinical";
import { regimenSummary } from "@/lib/insulin";
import { formatCairoLong } from "@/lib/time";
import { getCensus, getRoster } from "@/server/queries";

export const metadata = { title: "Ward census" };
export const dynamic = "force-dynamic";

export default async function CensusPrint() {
  const [{ board, admissions, regimens, meds }, roster] = await Promise.all([getCensus(), getRoster()]);
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-3 border-b-2 border-black pb-2">
        <div>
          <h1>National Institute for Diabetes and Endocrinology</h1>
          <p>Inpatient ward census and shift handover report</p>
        </div>
        <div className="muted text-right">
          <div>Printed (Cairo): {formatCairoLong()}</div>
          <div>Shift: 09:00 AM daily, 24 hours</div>
          <div>Duty doctors: {roster ? `${roster.doc1}${roster.doc2 ? ` and ${roster.doc2}` : ""}` : "not set"}</div>
          <div>Attending: {roster?.attending ?? "not set"}</div>
        </div>
      </div>
      <table className="mt-3">
        <thead>
          <tr>
            <th>Bed</th>
            <th>Patient</th>
            <th>Diagnosis and risks</th>
            <th>Latest ABG</th>
            <th>Insulin and drugs</th>
            <th>Follow-up plan</th>
          </tr>
        </thead>
        <tbody>
          {board.flatMap((w) =>
            w.beds.map((b) => {
              const a = b.admission;
              if (!a) {
                return (
                  <tr key={b.id} className="muted">
                    <td>{w.title}, {b.name}</td>
                    <td colSpan={5}><em>Available bed</em></td>
                  </tr>
                );
              }
              const full = admissions.get(a.id);
              const reg = regimens.get(a.id);
              const res = analyzeABG(a.latestAbg);
              const drugs = meds.filter((m) => m.admissionId === a.id);
              return (
                <tr key={b.id}>
                  <td>{w.title}, {b.name}</td>
                  <td><b>{patientLabel(a.patientName)}</b>{a.age !== null && ` (${ageShort(a.age)})`}</td>
                  <td>
                    <b>{isBlank(a.diagnosis) ? NO_DIAGNOSIS : a.diagnosis}</b>
                    <div className="muted">{full?.riskFactors || "None"}</div>
                  </td>
                  <td>
                    {a.latestAbg
                      ? `pH ${a.latestAbg.ph ?? "--"} pCO2 ${a.latestAbg.pco2 ?? "--"} HCO3 ${a.latestAbg.hco3 ?? "--"} (AG ${res && res.ag !== null ? res.ag : "unmeasured"})`
                      : "No ABG"}
                    <div className="muted">
                      Acetone {full?.urineAcetone ?? "Negative"}. {res?.isShiftReady ? "Shift to basal-bolus (pH 7.35 or above)" : "Q2H IM insulin protocol"}
                    </div>
                  </td>
                  <td>
                    {reg ? regimenSummary(reg) : "--"}
                    <div className="muted">Rx: {drugs.length ? drugs.map((d) => `${d.name} (${d.dose})`).join(", ") : "None"}</div>
                  </td>
                  <td>{full?.followupPlan || "Routine ward care"}</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
