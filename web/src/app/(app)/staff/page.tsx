import { StaffManager } from "@/components/app/staff-manager";
import { requireStaff } from "@/lib/session";
import { listStaff } from "@/server/queries";

export const metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const [me, rows] = await Promise.all([requireStaff("staff.manage"), listStaff()]);
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-medium">Staff</h1>
        <p className="text-text-secondary">There is no public sign-up. Accounts are created here by an attending.</p>
      </div>
      <StaffManager
        selfId={me.userId}
        rows={rows.map((r) => ({ userId: r.userId, username: r.username, displayName: r.displayName, mustChangePassword: r.mustChangePassword, badgeNo: r.badgeNo, clinicalRole: r.clinicalRole, active: r.active }))}
      />
    </div>
  );
}
