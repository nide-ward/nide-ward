import { redirect } from "next/navigation";
import { LoginForm } from "@/components/app/login-form";
import { getStaff } from "@/lib/session";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getStaff()) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
      <div>
        <h1 className="text-2xl font-medium">Sign in</h1>
        <p className="mt-1 text-text-secondary">National Institute for Diabetes and Endocrinology, inpatient ward.</p>
      </div>
      <LoginForm />
      <p className="text-sm text-text-secondary">Accounts are created by an attending. Sessions end after a period of inactivity, so sign out on shared computers.</p>
    </main>
  );
}
