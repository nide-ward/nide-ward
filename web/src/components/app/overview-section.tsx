"use client";

import { useState } from "react";
import Button from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { updateChart } from "@/server/actions/patients";
import { fromCairoInputValue, toCairoInputValue } from "@/lib/time";
import { AGE_ERROR, NO_DIAGNOSIS, ageText, isBlank, parseAgeInput, patientLabel } from "@/lib/display";
import { normalizeNumericText } from "@/lib/numeric-input";
import { URINE_ACETONE } from "@/lib/validation";
import { useChart } from "./chart-context";
import { useAction } from "./use-action";
import { type Hue } from "@/lib/hues";
import { Definition, InlineError, Panel } from "./ui";
import { RISK_FACTORS_MAX, RiskFactorChips } from "./risk-factor-chips";

export interface OverviewData {
  patientName: string;
  age: number | null;
  admittedAt: Date;
  diagnosis: string;
  riskFactors: string;
  labsImaging: string;
  consultations: string;
  followupPlan: string;
  urineAcetone: (typeof URINE_ACETONE)[number];
  currentRbg: number | null;
}

function ChartForm({ data }: { data: OverviewData }) {
  const chart = useChart();
  const { run, pending, error, conflict } = useAction();
  const [name, setName] = useState(data.patientName);
  const [age, setAge] = useState(data.age === null ? "" : String(data.age));
  const [admittedAt, setAdmittedAt] = useState(toCairoInputValue(data.admittedAt));
  const [diagnosis, setDiagnosis] = useState(data.diagnosis);
  const [risk, setRisk] = useState(data.riskFactors);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        const parsedAge = parseAgeInput(age);
        if (!parsedAge.valid) {
          setLocalError(AGE_ERROR);
          return;
        }
        setLocalError(null);
        const when = fromCairoInputValue(admittedAt);
        const chartPayload = {
          admissionId: chart.admissionId,
          version: chart.version,
          patientName: name,
          age: parsedAge.value,
          admittedAt: when ? when.toISOString() : undefined,
          diagnosis,
          riskFactors: risk,
          labsImaging: data.labsImaging,
          consultations: data.consultations,
          followupPlan: data.followupPlan,
        };
        void run(
          () => updateChart(chartPayload),
          (r) => {
            chart.setVersion(r.version);
            setSaved(true);
          },
          {
            type: "updateChart",
            payload: chartPayload,
            description: `Update demographics for ${name || "Patient"}`,
            optimisticResult: { version: chart.version + 1 },
          },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem] sm:items-start">
        <Input label="Patient name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <Input label="Age (years)" type="text" inputMode="numeric" autoComplete="off" value={age} onChange={(e) => setAge(normalizeNumericText(e.target.value))} />
      </div>
      <label className="grid min-w-0 gap-1.5">
        <span className="text-sm font-medium">Admission date and time (Cairo)</span>
        <input className="native-field" type="datetime-local" value={admittedAt} onChange={(e) => setAdmittedAt(e.target.value)} />
      </label>
      <Input label="Primary diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} maxLength={300} />
      <div className="grid gap-2">
        <RiskFactorChips value={risk} onChange={setRisk} />
        <Textarea label="Risk factors and comorbidities" value={risk} onChange={(e) => setRisk(e.target.value)} rows={2} maxLength={RISK_FACTORS_MAX} />
      </div>
      <InlineError>{localError ?? error}</InlineError>
      {conflict && <p className="text-sm text-text-secondary">Use the banner above to load the latest chart, then repeat your edit.</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Save chart
        </Button>
        {saved && !error && <span role="status" className="text-sm text-success">Chart saved</span>}
      </div>
    </form>
  );
}

export function OverviewSection({ data, hue }: { data: OverviewData; hue: Hue }) {
  const chart = useChart();
  return (
    <div className="grid gap-4">
      <Panel hue={hue} title="Patient admission details">
        {chart.allowed("chart.edit") ? (
          <ChartForm data={data} />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Definition label="Patient">{[patientLabel(data.patientName), ageText(data.age)].filter(Boolean).join(", ")}</Definition>
            <Definition label="Admitted (Cairo)">{toCairoInputValue(data.admittedAt).replace("T", " ")}</Definition>
            <Definition label="Primary diagnosis">{isBlank(data.diagnosis) ? <span className="text-text-muted">{NO_DIAGNOSIS}</span> : data.diagnosis}</Definition>
            <Definition label="Risk factors">{data.riskFactors}</Definition>
          </dl>
        )}
      </Panel>
    </div>
  );
}
