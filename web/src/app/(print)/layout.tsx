import type { ReactNode } from "react";
import { PrintButton } from "@/components/app/print-button";
import { requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PrintLayout({ children }: { children: ReactNode }) {
  await requireStaff();
  return (
    <>
      <PrintButton />
      <main className="print-sheet mx-auto max-w-5xl p-4 sm:p-6">{children}</main>
    </>
  );
}
