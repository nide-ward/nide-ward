"use client";

import { useState } from "react";
import Button from "@/components/arc/button/button";
import { NumberField } from "@/components/arc/number-field/number-field";
import { regimenSummary } from "@/lib/insulin";
import { saveInsulin } from "@/server/actions/patients";
import { useChart } from "./chart-context";
import { useAction } from "./use-action";
import { InlineError, Panel } from "./ui";

export interface InsulinData {
  basalUnits: number;
  breakfastUnits: number;
  lunchUnits: number;
  dinnerUnits: number;
  basalLabel: string;
  updatedBy: string;
}

export function InsulinSection({ data }: { data: InsulinData }) {
  const chart = useChart();
  const { run, pending, error } = useAction();
  const [v, setV] = useState({ basal: data.basalUnits, b: data.breakfastUnits, l: data.lunchUnits, d: data.dinnerUnits });
  const [saved, setSaved] = useState(false);
  const editable = chart.allowed("insulin.edit");

  return (
    <Panel title="Insulin regimen" description={`${data.basalLabel}. Last changed by ${data.updatedBy}.`}>
      <p className="tnum mb-4 rounded-xl bg-surface-muted px-3 py-2 text-sm" aria-live="polite">
        {regimenSummary({ basalUnits: v.basal, breakfastUnits: v.b, lunchUnits: v.l, dinnerUnits: v.d })}
      </p>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          void run(
            () =>
              saveInsulin({
                admissionId: chart.admissionId,
                version: chart.version,
                basalUnits: v.basal,
                breakfastUnits: v.b,
                lunchUnits: v.l,
                dinnerUnits: v.d,
              }),
            (r) => {
              chart.setVersion(r.version);
              setSaved(true);
            },
          );
        }}
      >
        <Panel hue="purple" title="Basal insulin" description="Lantus (glargine), once a day at 11:00 PM.">
          <div className="max-w-xs">
          <NumberField label="Basal Lantus at 11:00 PM" suffix=" U" min={0} max={500} step={0.5} value={v.basal} onValueChange={(x) => setV((s) => ({ ...s, basal: x }))} disabled={!editable} />
          </div>
        </Panel>
        <Panel hue="amber" title="Bolus insulin" description="Actrapid before each meal.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField label="Actrapid breakfast at 9:00 AM" suffix=" U" min={0} max={500} step={0.5} value={v.b} onValueChange={(x) => setV((s) => ({ ...s, b: x }))} disabled={!editable} />
          <NumberField label="Actrapid lunch at 3:00 PM" suffix=" U" min={0} max={500} step={0.5} value={v.l} onValueChange={(x) => setV((s) => ({ ...s, l: x }))} disabled={!editable} />
          <NumberField label="Actrapid dinner at 9:00 PM" suffix=" U" min={0} max={500} step={0.5} value={v.d} onValueChange={(x) => setV((s) => ({ ...s, d: x }))} disabled={!editable} />
          </div>
        </Panel>
        <InlineError>{error}</InlineError>
        {editable && (
          <div className="flex items-center gap-3">
            <Button type="submit" loading={pending}>
              Save regimen
            </Button>
            {saved && !error && <span role="status" className="text-sm text-success">Regimen saved</span>}
          </div>
        )}
      </form>
    </Panel>
  );
}
