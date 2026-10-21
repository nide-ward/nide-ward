import { ArchiveView, type ArchiveRow } from "@/components/app/archive-view";
import { patientLabel } from "@/lib/display";
import { regimenSummary } from "@/lib/insulin";
import { requireStaff } from "@/lib/session";
import { formatCairo } from "@/lib/time";
import { listArchive } from "@/server/queries";

export const metadata = { title: "Archive" };
export const dynamic = "force-dynamic";

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [, { rows, total, pageSize }] = await Promise.all([requireStaff(), listArchive(q, page)]);

  const data: ArchiveRow[] = rows.map(({ admission: a, bed, ward, latestAbg, regimen }) => ({
    id: a.id,
    patient: patientLabel(a.patientName),
    age: a.age,
    bed: bed.name,
    ward: ward.title,
    admitted: formatCairo(a.admittedAt),
    discharged: formatCairo(a.dischargedAt),
    outcome: a.dischargeOutcome ?? "",
    diagnosis: a.diagnosis,
    lastAbg: latestAbg ? `pH ${latestAbg.ph ?? "--"}, pCO2 ${latestAbg.pco2 ?? "--"}, HCO3 ${latestAbg.hco3 ?? "--"}` : "No ABG records",
    insulin: regimen ? regimenSummary(regimen) : "--",
  }));

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-medium">Archive</h1>
        <p className="text-text-secondary">Discharged admissions. Records are never deleted from the app.</p>
      </div>
      <ArchiveView rows={data} total={total} page={page} pageSize={pageSize} q={q} />
    </div>
  );
}
