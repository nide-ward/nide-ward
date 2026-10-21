"use client";

import Button from "@/components/arc/button/button";

export function PrintButton() {
  return (
    <div className="no-print flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
      <p className="text-sm text-text-secondary">Print preview. Use the browser print dialog to print or save as PDF.</p>
      <Button onClick={() => window.print()}>Print</Button>
    </div>
  );
}
