"use client";

import { useState } from "react";
import Button from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Select } from "@/components/arc/select/select";
import { recordBedside, updateChart } from "@/server/actions/patients";
import { fromCairoInputValue, toCairoInputValue } from "@/lib/time";
import { parseMeasurement } from "@/lib/clinical";
import { AGE_ERROR, NO_DIAGNOSIS, ageText, isBlank, parseAgeInput, patientLabel } from "@/lib/display";
import { normalizeNumericText } from "@/lib/numeric-input";
import { URINE_ACETONE } from "@/lib/validation";
import { useChart } from "./chart-context";
import { useAction } from "./use-action";
import { ACETONE_HUE, type Hue } from "@/lib/hues";
import { Definition, InlineError, Panel, Pill } from "./ui";
import { useToast } from "./toast-provider";

const RISK_TAGS = [
  "Missed Doses",
  "Common Cold",
  "Recent T1DM",
  "Dysuria",
  "SGLT2i",
  "Type 1 DM",
  "Type 2 DM",
  "Hypertension",
  "CKD Stage 3",
  "CAD / IHD",
  "History of recurrent DKA",
  "Heavy Smoker",
];

const ACETONE_OPTIONS = [
  { value: "Negative", label: "Negative (nil)" },
  { value: "Trace", label: "Trace (+/-)" },
  { value: "+", label: "+ (small)" },
  { value: "++", label: "++ (moderate)" },
  { value: "+++", label: "+++ (large)" },
  { value: "++++", label: "++++ (very large)" },
];

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

/** Bedside values: fingerstick RBG and urine acetone. Nurses can record these. */
function BedsideCard({ data, hue }: { data: OverviewData; hue: Hue }) {
  const chart = useChart();
  const { run, pending, error } = useAction();
  const { toast } = useToast();
  const [acetone, setAcetone] = useState<string>(data.urineAcetone);
  const [rbg, setRbg] = useState(data.currentRbg === null ? "" : String(data.currentRbg));
  const allowed = chart.allowed("bedside.record");

  return (
    <Panel hue={hue} title="Bedside readings" description="Fingerstick glucose and urine acetone. These drive the fluid protocol." action={<Pill hue={ACETONE_HUE[acetone]}>Acetone: {acetone}</Pill>}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () => recordBedside({ admissionId: chart.admissionId, urineAcetone: acetone, currentRbg: parseMeasurement(rbg) }),
            () => toast("Bedside readings saved"),
          );
        }}
      >
        <Select label="Urine acetone" options={ACETONE_OPTIONS} value={acetone} onValueChange={setAcetone} disabled={!allowed} />
        <Input
          label="Current RBG (mg/dL)"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={rbg}
          onChange={(e) => setRbg(normalizeNumericText(e.target.value))}
          disabled={!allowed}
        />
        {allowed && (
          <div className="sm:col-span-2">
            <Button type="submit" loading={pending}>
              Save bedside readings
            </Button>
          </div>
        )}
        <div className="sm:col-span-2">
          <InlineError>{error}</InlineError>
        </div>
      </form>
    </Panel>
  );
}

function ChartForm({ data }: { data: OverviewData }) {
  const chart = useChart();
  const { run, pending, error, conflict } = useAction();
  const [name, setName] = useState(data.patientName);
  const [age, setAge] = useState(data.age === null ? "" : String(data.age));
  const [admittedAt, setAdmittedAt] = useState(toCairoInputValue(data.admittedAt));
  const [diagnosis, setDiagnosis] = useState(data.diagnosis);
  const [risk, setRisk] = useState(data.riskFactors);
  const [labs, setLabs] = useState(data.labsImaging);
  const [consults, setConsults] = useState(data.consultations);
  const [plan, setPlan] = useState(data.followupPlan);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const addTag = (tag: string) => setRisk((r) => (r.trim() === "" ? tag : r.includes(tag) ? r : `${r.trim()}, ${tag}`));

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
        void run(
          () =>
            updateChart({
              admissionId: chart.admissionId,
              version: chart.version,
              patientName: name,
              age: parsedAge.value,
              // Blank or unreadable: the server keeps the recorded admission time.
              admittedAt: when ? when.toISOString() : undefined,
              diagnosis,
              riskFactors: risk,
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
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem] sm:items-start">
        <Input label="Patient name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <Input label="Age (years)" type="text" inputMode="numeric" autoComplete="off" value={age} onChange={(e) => setAge(normalizeNumericText(e.target.value))} />
      </div>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">Admission date and time (Cairo)</span>
        <input className="native-field" type="datetime-local" value={admittedAt} onChange={(e) => setAdmittedAt(e.target.value)} />
      </label>
      <Input label="Primary diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} maxLength={300} />
      <div className="grid gap-2">
        <Textarea label="Risk factors and comorbidities" value={risk} onChange={(e) => setRisk(e.target.value)} rows={2} maxLength={1000} />
        <div className="flex flex-wrap gap-2" aria-label="Add a common risk factor">
          {RISK_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addTag(t)}
              className="min-h-11 rounded-full border border-border px-3 text-sm text-text-secondary hover:bg-surface-muted"
            >
              Add {t}
            </button>
          ))}
        </div>
      </div>
      <Textarea label="Labs and imaging" value={labs} onChange={(e) => setLabs(e.target.value)} rows={2} maxLength={2000} />
      <Textarea label="Consultations" value={consults} onChange={(e) => setConsults(e.target.value)} rows={2} maxLength={2000} />
      <Textarea label="Follow-up and discharge plan" value={plan} onChange={(e) => setPlan(e.target.value)} rows={3} maxLength={2000} />
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
      <BedsideCard data={data} hue={hue} />
      <Panel hue={hue} title="Patient and plan">
        {chart.allowed("chart.edit") ? (
          <ChartForm data={data} />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Definition label="Patient">{[patientLabel(data.patientName), ageText(data.age)].filter(Boolean).join(", ")}</Definition>
            <Definition label="Admitted (Cairo)">{toCairoInputValue(data.admittedAt).replace("T", " ")}</Definition>
            <Definition label="Primary diagnosis">{isBlank(data.diagnosis) ? <span className="text-text-muted">{NO_DIAGNOSIS}</span> : data.diagnosis}</Definition>
            <Definition label="Risk factors">{data.riskFactors}</Definition>
            <Definition label="Labs and imaging">{data.labsImaging}</Definition>
            <Definition label="Consultations">{data.consultations}</Definition>
            <div className="sm:col-span-2">
              <Definition label="Follow-up and discharge plan">{data.followupPlan}</Definition>
            </div>
          </dl>
        )}
      </Panel>
    </div>
  );
}
