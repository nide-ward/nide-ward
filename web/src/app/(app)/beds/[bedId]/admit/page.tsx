import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { AdmitPageForm } from "@/components/app/admit-dialog";
import { Panel } from "@/components/app/ui";
import { requireStaff } from "@/lib/session";
import { toCairoInputValue } from "@/lib/time";
import { getActiveAdmissionIdForBed, getBed } from "@/server/queries";

export const metadata = { title: "Admit patient" };
export const dynamic = "force-dynamic";

export default async function AdmitPage({ params }: { params: Promise<{ bedId: string }> }) {
  const { bedId } = await params;
  const [, found, existing] = await Promise.all([
    requireStaff("patient.admit"),
    getBed(bedId),
    getActiveAdmissionIdForBed(bedId),
  ]);
  if (!found) notFound();
  if (existing) redirect(`/patients/${existing}`);
  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div>
        <h1 className="text-2xl font-medium">Admit to {found.bed.name}</h1>
        <p className="text-text-secondary">{found.ward.title}. Everything is optional.</p>
      </div>
      <Panel>
        <AdmitPageForm bedId={bedId} bedName={found.bed.name} initialTime={toCairoInputValue(new Date())} />
      </Panel>
    </div>
  );
}
