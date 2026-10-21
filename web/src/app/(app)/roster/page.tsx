import { RosterForm } from "@/components/app/roster-form";
import { Panel } from "@/components/app/ui";
import { requireStaff } from "@/lib/session";
import { formatCairo } from "@/lib/time";
import { getRoster } from "@/server/queries";

export const metadata = { title: "Shift roster" };
export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const [, r] = await Promise.all([requireStaff("roster.edit"), getRoster()]);
  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div>
        <h1 className="text-2xl font-medium">Shift roster</h1>
        <p className="text-text-secondary">
          Shows in the header and on printed sheets. Shift starts at 09:00 Cairo, 24 hours.
          {r ? ` Last updated ${formatCairo(r.updatedAt)} by ${r.updatedBy}.` : ""}
        </p>
      </div>
      <Panel>
        <RosterForm initial={{ doc1: r?.doc1 ?? "", doc2: r?.doc2 ?? "", attending: r?.attending ?? "" }} />
      </Panel>
    </div>
  );
}
