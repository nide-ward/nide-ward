import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/app/change-password-form";
import { getStaff } from "@/lib/session";

export const metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

/**
 * Outside the (app) layout on purpose: that layout sends anyone with a temporary password here,
 * so this page must not use it. Also reachable later to change a password voluntarily.
 */
export default async function ChangePasswordPage() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div>
        <h1 className="text-2xl font-medium">{staff.mustChangePassword ? "Set your password" : "Change your password"}</h1>
        <p className="mt-1 text-text-secondary">
          {staff.mustChangePassword
            ? `Welcome, ${staff.displayName}. You signed in with a temporary password. Choose your own to continue. From now on you sign in as ${staff.username} with the new password.`
            : `Signed in as ${staff.username}.`}
        </p>
      </div>
      <ChangePasswordForm forced={staff.mustChangePassword} />
    </main>
  );
}
