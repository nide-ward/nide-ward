import { AutoRefresh } from "@/components/app/auto-refresh";
import { Board } from "@/components/app/board";
import EmptyState from "@/components/arc/empty-state/empty-state";
import { uploadMode } from "@/lib/env";
import { requireStaff } from "@/lib/session";
import { getBoard } from "@/server/queries";

export const metadata = { title: "Ward board" };
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  // Run in parallel; requireStaff redirects before any data is rendered if signed out.
  const [staff, wards] = await Promise.all([requireStaff(), getBoard()]);
  if (wards.length === 0) {
    return (
      <EmptyState
        title="No wards found"
        description="The database has no wards yet. Run the seed script (pnpm db:seed) to create the wards and beds."
      />
    );
  }
  return (
    <>
      <AutoRefresh intervalMs={10000} />
      <Board wards={wards} role={staff.role} uploadMode={uploadMode()} />
    </>
  );
}
