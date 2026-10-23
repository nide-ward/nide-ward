import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/app-header";
import { requireStaff } from "@/lib/session";
import { getRoster } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [staff, roster] = await Promise.all([requireStaff(), getRoster()]);
  return (
    <>
      <AppHeader
        name={staff.displayName}
        role={staff.role}
        theme={staff.theme}
        roster={roster ? { doc1: roster.doc1, doc2: roster.doc2, attending: roster.attending } : null}
      />
      {/* Bottom padding on phones clears the fixed tab bar (3.5rem) plus the home indicator. */}
      <main className="mx-auto w-full max-w-7xl px-3 pt-3 sm:px-6 sm:py-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</main>
    </>
  );
}
