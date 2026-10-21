"use client";

import { useState } from "react";
import Button from "@/components/arc/button/button";
import { Textarea } from "@/components/arc/textarea/textarea";
import { updateChart } from "@/server/actions/patients";
import { useChart } from "./chart-context";
import { useAction } from "./use-action";
import { Definition, InlineError, Panel } from "./ui";
import { MediaSection, type MediaRow } from "./media-section";
import type { OverviewData } from "./overview-section";
import type { Hue } from "@/lib/hues";

export function PlanSection({ data, media, hue }: { data: OverviewData; media: MediaRow[]; hue: Hue }) {
  const chart = useChart();
  const { run, pending, error, conflict } = useAction();
  const [labs, setLabs] = useState(data.labsImaging);
  const [consults, setConsults] = useState(data.consultations);
  const [plan, setPlan] = useState(data.followupPlan);
  const [saved, setSaved] = useState(false);
  const editable = chart.allowed("chart.edit");

  return (
    <div className="grid gap-4">
      <Panel hue={hue} title="Workup & clinical plan" description="Follow-up plan, ordered labs/imaging, and specialist consults.">
        {editable ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(false);
              void run(
                () =>
                  updateChart({
                    admissionId: chart.admissionId,
                    version: chart.version,
                    patientName: data.patientName,
                    age: data.age,
                    admittedAt: data.admittedAt,
                    diagnosis: data.diagnosis,
                    riskFactors: data.riskFactors,
                    labsImaging: labs,
                    consultations: consults,
                    followupPlan: plan,
                  }),
                (r) => {
                  chart.setVersion(r.version);
                  setSaved(true);
                },
              );
            }}
          >
            <Textarea
              label="Follow-up and discharge plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Shift to subcutaneous insulin once anion gap closes and acetone is negative. Discontinue IV fluids."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Textarea
                label="Labs and imaging"
                value={labs}
                onChange={(e) => setLabs(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="CBC, serum creatinine and electrolytes, chest X-ray"
              />
              <Textarea
                label="Consultations"
                value={consults}
                onChange={(e) => setConsults(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Endocrinology, Nephrology"
              />
            </div>
            <InlineError>{error}</InlineError>
            {conflict && <p className="text-sm text-text-secondary">Use the banner above to load the latest chart, then repeat your edit.</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" loading={pending}>
                Save plan
              </Button>
              {saved && !error && <span role="status" className="text-sm text-success">Plan saved</span>}
            </div>
          </form>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Definition label="Follow-up and discharge plan">{data.followupPlan || "None recorded"}</Definition>
            </div>
            <Definition label="Labs and imaging">{data.labsImaging || "None recorded"}</Definition>
            <Definition label="Consultations">{data.consultations || "None recorded"}</Definition>
          </dl>
        )}
      </Panel>

      <MediaSection media={media} />
    </div>
  );
}
