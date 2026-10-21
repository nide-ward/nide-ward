import { NO_DIAGNOSIS, ageText, isBlank, patientLabel } from "@/lib/display";
import { notFound } from "next/navigation";
import { regimenSummary } from "@/lib/insulin";
import { analyzeABG, fluidGuidance } from "@/lib/clinical";
import { formatCairo, formatCairoLong } from "@/lib/time";
import { getAdmissionDetail, getRoster } from "@/server/queries";

export const metadata = { title: "Patient chart" };
export const dynamic = "force-dynamic";

const n = (v: number | null | undefined) => (v === null || v === undefined ? "--" : v);

export default async function PatientPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [d, roster] = await Promise.all([getAdmissionDetail(id), getRoster()]);
  if (!d) notFound();
  const { admission: a, bed, ward, abgs, regimen, meds } = d;
  const latest = abgs.length ? abgs[abgs.length - 1] : null;
  const analysis = analyzeABG(latest);
  const fluid = fluidGuidance(a.urineAcetone, latest);
  const discharged = a.status === "discharged";

  return (
    <div>
      <div className="flex flex-wrap justify-between gap-3 border-b-2 border-black pb-2">
        <div>
          <h1>National Institute for Diabetes and Endocrinology</h1>
          <p>{discharged ? "Medicolegal patient discharge record and case summary" : "Inpatient clinical chart and handover summary"}</p>
        </div>
        <div className="muted text-right">
          <div>{ward.title}, {bed.name}</div>
          <div>Printed (Cairo): {formatCairoLong()}</div>
          <div>Attending: {discharged ? a.attendingAtDischarge || "not recorded" : roster?.attending ?? "not set"}</div>
          <div className="text-xs">Record {a.id}</div>
        </div>
      </div>

      <div className="mt-3 rounded border border-black p-2">
        <div><b>Patient:</b> {patientLabel(a.patientName)}{a.age !== null && <> | <b>Age:</b> {ageText(a.age)}</>} | <b>Admitted (Cairo):</b> {formatCairo(a.admittedAt)} by {a.admittedBy}</div>
        <div><b>Primary diagnosis:</b> {isBlank(a.diagnosis) ? NO_DIAGNOSIS : a.diagnosis}</div>
        <div className="muted"><b>Risk factors:</b> {a.riskFactors || "None reported"}</div>
        {discharged && (
          <>
            <div className="mt-1"><b>Discharged:</b> {formatCairo(a.dischargedAt)} by {a.dischargedBy}</div>
            <div><b>Outcome:</b> {a.dischargeOutcome}</div>
          </>
        )}
      </div>

      {!discharged && (
        <p className="mt-2 rounded border border-black p-2">
          <b>Protocol evaluation:</b>{" "}
          {analysis?.isShiftReady ? "pH 7.35 or above and trusted: shift to basal-bolus insulin." : "pH below 7.35 (or untrusted): maintain Q2H intramuscular insulin."} <b>Fluids:</b> {fluid.text}
        </p>
      )}

      <h2>Serial blood gases</h2>
      <table>
        <thead>
          <tr>
            <th>Time (Cairo)</th><th>pH</th><th>pCO2</th><th>HCO3</th><th>AG</th><th>Winter&rsquo;s</th><th>Delta</th><th>RBG</th><th>K</th><th>Na</th><th>Hb</th>
          </tr>
        </thead>
        <tbody>
          {abgs.length === 0 ? (
            <tr><td colSpan={11}>No ABG records.</td></tr>
          ) : (
            abgs.map((r) => {
              const x = analyzeABG(r);
              return (
                <tr key={r.id}>
                  <td>{formatCairo(r.takenAt)}</td>
                  <td style={r.ph !== null && r.ph < 7.35 ? { fontWeight: 500, textDecoration: "underline" } : undefined}>{n(r.ph)}</td>
                  <td>{n(r.pco2)}</td><td>{n(r.hco3)}</td><td>{x && x.ag !== null ? x.ag : "--"}</td>
                  <td>{x && x.wintersMin !== null ? `${x.wintersMin}-${x.wintersMax}` : "--"}</td>
                  <td>{x && x.deltaRatio !== null ? x.deltaRatio : "--"}</td>
                  <td>{n(r.rbg)}</td><td>{n(r.k)}</td><td>{n(r.na)}</td><td>{n(r.hb)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-black p-2">
          <h2 style={{ marginTop: 0 }}>Insulin</h2>
          <div>{regimen ? regimenSummary(regimen) : "--"}</div>
          <div className="mt-1"><b>Acetone:</b> {a.urineAcetone} | <b>RBG:</b> {n(a.currentRbg)} mg/dL</div>
        </div>
        <div className="rounded border border-black p-2">
          <h2 style={{ marginTop: 0 }}>Concomitant drugs</h2>
          <table>
            <thead><tr><th>Drug</th><th>Dose</th><th>Frequency</th></tr></thead>
            <tbody>
              {meds.length === 0 ? <tr><td colSpan={3}>No other drugs prescribed.</td></tr> : meds.map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.dose}</td><td>{m.frequency}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 rounded border border-black p-2">
        <div><b>Labs and consults:</b> {a.labsImaging || "None"} | {a.consultations || "None"}</div>
        <div className="mt-1"><b>Follow-up and discharge plan:</b> {a.followupPlan || "Routine ward care"}</div>
        {discharged && a.dischargeNotes && <div className="mt-1"><b>Discharge summary:</b> {a.dischargeNotes}</div>}
      </div>

      {discharged && (
        <div className="mt-8 flex flex-wrap justify-between gap-6 border-t border-black pt-2">
          <div><b>Discharging clinician:</b> {a.dischargedBy} ____________________</div>
          <div><b>Attending consultant:</b> {a.attendingAtDischarge} ____________________</div>
        </div>
      )}
    </div>
  );
}
