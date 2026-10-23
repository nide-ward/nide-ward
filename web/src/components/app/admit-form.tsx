"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { NumberField } from "@/components/arc/number-field/number-field";
import { Textarea } from "@/components/arc/textarea/textarea";
import { admitPatient } from "@/server/actions/patients";
import { parseABGSlipText, parseMeasurement } from "@/lib/clinical";
import { normalizeNumericText } from "@/lib/numeric-input";
import { fromCairoInputValue, toCairoInputValue } from "@/lib/time";
import { AGE_ERROR, parseAgeInput } from "@/lib/display";
import { EMPTY, FIELDS, slipToFields, type FieldKey } from "./abg-fields";
import { SlipScanner } from "./slip-scanner";
import { regimenSummary } from "@/lib/insulin";
import { useAction } from "./use-action";
import { InlineError, Panel } from "./ui";

const TAGS = ["Missed Doses", "Common Cold", "Recent T1DM", "Dysuria", "SGLT2i"];

/** The prototype's admit window had these four tabs; here they are steps, saved together at the end. */
const STEPS = ["Admission and info", "First blood gas", "Insulin and drugs", "Workup and plan"];

interface Med {
  name: string;
  dose: string;
  frequency: string;
}

/** Server validation errors start with the field path; send the user back to the step that holds it. */
function stepForError(error: string): number | null {
  if (error.startsWith("firstAbg")) return 1;
  if (error.startsWith("insulin") || error.startsWith("medications")) return 2;
  if (/^(labsImaging|consultations|followupPlan)/.test(error)) return 3;
  if (/^(patientName|age|admittedAt|diagnosis|riskFactors)/.test(error)) return 0;
  return null;
}

function Steps({ step, onGo }: { step: number; onGo: (i: number) => void }) {
  return (
    <nav aria-label="Admission steps" className="grid gap-2">
      <p className="text-sm text-text-secondary" aria-live="polite">
        Step {step + 1} of {STEPS.length}: <span className="font-medium text-foreground">{STEPS[step]}</span>
      </p>
      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label}>
            {/* Like the prototype's tabs, any step can be opened at any time; nothing is required, so nothing is blocked. */}
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-current={i === step ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${label}`}
              className="flex h-6 w-full items-center"
            >
              <span className={`block h-1.5 w-full rounded-full ${i <= step ? "bg-accent" : "bg-surface-muted"}`} />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export interface AdmitFormProps {
  bedId: string;
  initialTime: string;
  /** Called after the patient is admitted. The caller closes the dialog or leaves the page, and shows the toast. */
  onDone: (admissionId: string) => void;
  onCancel: () => void;
  /** True once anything has been entered, so the caller can confirm before discarding. */
  onDirtyChange?: (dirty: boolean) => void;
  /** In a dialog the action bar sticks to the bottom of the sheet. */
  inDialog?: boolean;
}

export function AdmitForm({ bedId, initialTime, onDone, onCancel, onDirtyChange, inDialog = false }: AdmitFormProps) {
  const { run, pending, error } = useAction();
  const [localError, setLocalError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // Step 1: admission and info
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [when, setWhen] = useState(initialTime);
  const [dx, setDx] = useState("");
  const [risk, setRisk] = useState("");

  // Step 2: first blood gas (optional). Drawn at intake by default.
  const [abgAt, setAbgAt] = useState<string | null>(null);
  const [abg, setAbg] = useState<Record<FieldKey, string>>(EMPTY);
  const [slip, setSlip] = useState("");
  const [slipMsg, setSlipMsg] = useState<string | null>(null);
  const [showSlip, setShowSlip] = useState(false);
  const abgEntered = Object.values(abg).some((v) => v.trim() !== "");

  // Step 3: insulin and drugs
  const [ins, setIns] = useState({ basal: 0, q2h: 0, b: 0, l: 0, d: 0 });
  const [meds, setMeds] = useState<Med[]>([]);
  const [med, setMed] = useState<Med>({ name: "", dose: "", frequency: "" });

  // Step 4: workup and plan
  const [labs, setLabs] = useState("");
  const [consults, setConsults] = useState("");
  const [plan, setPlan] = useState("");

  // Anything entered (other than the pre-filled time) counts as unsaved work.
  const dirty =
    [name, age, dx, risk, slip, labs, consults, plan, med.name, med.dose, med.frequency].some((v) => v.trim() !== "") ||
    abgEntered ||
    meds.length > 0 ||
    ins.basal + ins.b + ins.l + ins.d > 0 ||
    when !== initialTime ||
    abgAt !== null;
  const lastDirty = useRef(false);
  useEffect(() => {
    if (lastDirty.current !== dirty) {
      lastDirty.current = dirty;
      onDirtyChange?.(dirty);
    }
  }, [dirty, onDirtyChange]);

  // A new server error moves to its step (adjusting state during render, as React recommends over an effect).
  const [seenError, setSeenError] = useState<string | null>(null);
  if (error !== seenError) {
    setSeenError(error);
    const target = error ? stepForError(error) : null;
    if (target !== null) setStep(target);
  }

  const applySlip = () => {
    const parsed = parseABGSlipText(slip);
    const found = Object.keys(parsed).length;
    setAbg((v) => ({ ...v, ...slipToFields(parsed) }));
    setSlipMsg(found ? `${found} parameter${found === 1 ? "" : "s"} detected. Check them against the slip.` : "No values recognised. Check the pasted text.");
  };

  const addMed = () => {
    if (!med.name.trim()) return;
    setMeds((m) => [...m, { name: med.name.trim(), dose: med.dose.trim(), frequency: med.frequency.trim() }]);
    setMed({ name: "", dose: "", frequency: "" });
  };

  function save() {
    // Every field is optional. The only rules: age, when given, is whole years, and a blood gas needs its pH.
    const parsedAge = parseAgeInput(age);
    if (!parsedAge.valid) {
      setLocalError(AGE_ERROR);
      setStep(0);
      return;
    }
    if (abgEntered && abg.ph.trim() === "") {
      setLocalError("Enter the pH to record this blood gas, or clear the blood gas values.");
      setStep(1);
      return;
    }
    setLocalError(null);
    const admittedAt = fromCairoInputValue(when);
    const drawnAt = fromCairoInputValue(abgAt ?? when) ?? admittedAt ?? new Date();
    const n = (k: FieldKey) => parseMeasurement(abg[k]);
    const admitPayload = {
      bedId,
      patientName: name,
      age: parsedAge.value,
      // Blank or unreadable time: the server uses the current time.
      admittedAt: admittedAt ? admittedAt.toISOString() : undefined,
      diagnosis: dx,
      riskFactors: risk,
      firstAbg: abgEntered
        ? {
            takenAt: drawnAt.toISOString(),
            ph: n("ph") as number,
            pco2: n("pco2"),
            po2: n("po2"),
            hco3: n("hco3"),
            hco3Std: n("hco3Std"),
            na: n("na"),
            k: n("k"),
            cl: n("cl"),
            ca: n("ca"),
            rbg: n("rbg"),
            hb: n("hb"),
          }
        : null,
      insulin: { basalUnits: ins.basal, breakfastUnits: ins.b, lunchUnits: ins.l, dinnerUnits: ins.d },
      // A drug typed but not yet added with "Add drug" is still saved, plus Q2H Actrapid if set.
      medications: [
        ...(ins.q2h > 0 ? [{ name: "Insulin Actrapid (Q2H)", dose: `${ins.q2h} U`, frequency: "Every 2 hours" }] : []),
        ...(med.name.trim() ? [...meds, { name: med.name.trim(), dose: med.dose.trim(), frequency: med.frequency.trim() }] : meds),
      ],
      labsImaging: labs,
      consultations: consults,
      followupPlan: plan,
    };

    void run(
      () => admitPatient(admitPayload),
      (r) => onDone(r.admissionId),
      {
        type: "admitPatient",
        payload: admitPayload,
        description: `Admit Bed ${bedId} (${name || "Patient"})`,
        optimisticResult: { admissionId: `offline-${Date.now()}` },
      },
    );
  }

  const last = step === STEPS.length - 1;

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 0 && !parseAgeInput(age).valid) {
          setLocalError(AGE_ERROR);
          return;
        }
        setLocalError(null);
        if (last) save();
        else {
          setStep((s) => s + 1);
          if (!inDialog) window.scrollTo({ top: 0 });
        }
      }}
    >
      <Steps step={step} onGo={setStep} />

      {step === 0 && (
        <div className="grid gap-4">
          {/* items-start: the name field's hint must not stretch the age field to the same height. */}
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem] sm:items-start">
            <Input id="admit-name" label="Patient name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} description="Optional. Leave blank to admit now and complete the chart later." />
            <Input label="Age (years)" type="text" inputMode="numeric" autoComplete="off" value={age} onChange={(e) => setAge(normalizeNumericText(e.target.value))} />
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Admission date and time (Cairo)</span>
            <input className="native-field" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <Input label="Primary diagnosis" value={dx} onChange={(e) => setDx(e.target.value)} maxLength={300} placeholder="Diabetic ketoacidosis (DKA)" />
          <div className="grid gap-2">
            <Textarea label="Risk factors and comorbidities" value={risk} onChange={(e) => setRisk(e.target.value)} rows={2} maxLength={1000} />
            <div className="flex flex-wrap gap-2">
              {TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="min-h-11 rounded-full border border-border px-3 text-sm text-text-secondary hover:bg-surface-muted"
                  onClick={() => setRisk((r) => (r.trim() === "" ? t : r.includes(t) ? r : `${r.trim()}, ${t}`))}
                >
                  Add {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <Panel hue="sky" title="First blood gas">
        <div className="grid gap-4">
          <p className="text-sm text-text-secondary">Optional. Enter the intake blood gas now, or leave it empty and log it from the chart later. pH is required once any value is entered.</p>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Time drawn (Cairo)</span>
            <input className="native-field" type="datetime-local" value={abgAt ?? when} onChange={(e) => setAbgAt(e.target.value)} required={abgEntered} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setAbgAt(null)}>
              At admission
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setAbgAt(toCairoInputValue(new Date()))}>
              Now
            </Button>
          </div>
          <div className="grid gap-2">
            <SlipScanner
              onText={setSlip}
              onFallback={() => setShowSlip(true)}
              onApply={(found) => {
                setAbg((v) => ({ ...v, ...found }));
                setSlipMsg(`${Object.keys(found).length} value${Object.keys(found).length === 1 ? "" : "s"} filled from the scan. Check them against the slip.`);
              }}
            >
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowSlip((s) => !s)} aria-expanded={showSlip}>
                {showSlip ? "Hide slip text" : "Paste slip text"}
              </Button>
            </SlipScanner>
            {slipMsg && !showSlip && <span role="status" className="text-sm text-text-secondary">{slipMsg}</span>}
            {showSlip && (
              <div className="mt-2 grid gap-2">
                <Textarea label="Text from the analyser slip" value={slip} onChange={(e) => setSlip(e.target.value)} rows={6} placeholder={"pH 7.21\npCO2 29.4 mmHg\ncHCO3-(P) 11.2 mmol/L"} />
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="secondary" onClick={applySlip} disabled={!slip.trim()}>
                    Fill from slip
                  </Button>
                  {slipMsg && <span role="status" className="text-sm text-text-secondary">{slipMsg}</span>}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIELDS.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={f.placeholder}
                value={abg[f.key]}
                onChange={(e) => setAbg((v) => ({ ...v, [f.key]: normalizeNumericText(e.target.value) }))}
                required={f.key === "ph" && abgEntered}
              />
            ))}
          </div>
          {abgEntered && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setAbg(EMPTY)}>
              Clear blood gas
            </Button>
          )}
        </div>
        </Panel>
      )}

      {step === 2 && (
        <div className="grid gap-4">
          <p className="tnum rounded-xl bg-surface-muted px-3 py-2 text-sm" aria-live="polite">
            {regimenSummary({ basalUnits: ins.basal, breakfastUnits: ins.b, lunchUnits: ins.l, dinnerUnits: ins.d })}
            {ins.q2h > 0 && ` | Actrapid Q2H: ${ins.q2h}U`}
          </p>
          <Panel hue="sky" title="Actrapid every 2 hours (Q2H)" description="Short-acting regular insulin administered every 2 hours.">
            <div className="max-w-xs">
              <NumberField label="Actrapid every 2 hours" suffix=" U" min={0} max={500} step={2} value={ins.q2h} onValueChange={(x) => setIns((s) => ({ ...s, q2h: x }))} />
            </div>
          </Panel>
          <Panel hue="purple" title="Basal insulin" description="Lantus (glargine), given once a day at 11:00 PM.">
            <div className="max-w-xs">
              <NumberField label="Basal Lantus at 11:00 PM" suffix=" U" min={0} max={500} step={2} value={ins.basal} onValueChange={(x) => setIns((s) => ({ ...s, basal: x }))} />
            </div>
          </Panel>
          <Panel hue="amber" title="Bolus insulin" description="Actrapid before each meal.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumberField label="Actrapid breakfast at 9:00 AM" suffix=" U" min={0} max={500} step={2} value={ins.b} onValueChange={(x) => setIns((s) => ({ ...s, b: x }))} />
              <NumberField label="Actrapid lunch at 3:00 PM" suffix=" U" min={0} max={500} step={2} value={ins.l} onValueChange={(x) => setIns((s) => ({ ...s, l: x }))} />
              <NumberField label="Actrapid dinner at 9:00 PM" suffix=" U" min={0} max={500} step={2} value={ins.d} onValueChange={(x) => setIns((s) => ({ ...s, d: x }))} />
            </div>
          </Panel>

          <Panel hue="teal" title={`Other drugs (${meds.length})`}>
          <div className="grid gap-3">
            {meds.length > 0 && (
              <ul className="grid divide-y divide-border rounded-xl border border-border" aria-label="Drugs to add">
                {meds.map((m, i) => (
                  <li key={`${m.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-sm text-text-secondary">{[m.dose, m.frequency].filter(Boolean).join(", ") || "No dose recorded"}</p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${m.name}`} onClick={() => setMeds((all) => all.filter((_, j) => j !== i))}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
              <Input
                label="Drug name"
                value={med.name}
                onChange={(e) => setMed({ ...med, name: e.target.value })}
                maxLength={120}
                placeholder="Ceftriaxone"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMed();
                  }
                }}
              />
              <Input label="Dose" value={med.dose} onChange={(e) => setMed({ ...med, dose: e.target.value })} maxLength={60} placeholder="2g" />
              <Input label="Frequency" value={med.frequency} onChange={(e) => setMed({ ...med, frequency: e.target.value })} maxLength={60} placeholder="IV once daily" />
              <Button type="button" variant="secondary" onClick={addMed} disabled={!med.name.trim()}>
                Add drug
              </Button>
            </div>
          </div>
          </Panel>
        </div>
      )}

      {step === 3 && (
        <Panel hue="cyan" title="Workup and plan">
        <div className="grid gap-4">
          <Textarea label="Labs and imaging ordered" value={labs} onChange={(e) => setLabs(e.target.value)} rows={2} maxLength={2000} placeholder="CBC, serum creatinine and electrolytes, chest X-ray" />
          <Textarea label="Consultations needed" value={consults} onChange={(e) => setConsults(e.target.value)} rows={2} maxLength={2000} placeholder="Endocrinology (DKA protocol), nephrology" />
          <Textarea label="Follow-up and discharge plan" value={plan} onChange={(e) => setPlan(e.target.value)} rows={3} maxLength={2000} placeholder="Shift to subcutaneous insulin once the anion gap closes and acetone is negative." />
          <div className="grid gap-1 rounded-xl bg-surface-muted p-3 text-sm">
            <p className="font-medium">Saving will admit {name.trim() || "this patient"} and record:</p>
            <p>{abgEntered ? `First blood gas, pH ${abg.ph || "--"}` : "No blood gas yet"}</p>
            <p className="tnum">{regimenSummary({ basalUnits: ins.basal, breakfastUnits: ins.b, lunchUnits: ins.l, dinnerUnits: ins.d })}</p>
            <p>{meds.length + (med.name.trim() ? 1 : 0)} other drug{meds.length + (med.name.trim() ? 1 : 0) === 1 ? "" : "s"}</p>
            <p className="text-text-secondary">Lab photos can be attached from the chart once the patient is admitted.</p>
          </div>
        </div>
        </Panel>
      )}

      <InlineError>{localError ?? error}</InlineError>
      <div
        className={`flex flex-wrap gap-3 ${
          inDialog ? "sticky bottom-0 z-10 -mx-6 mt-1 border-t border-border bg-surface-raised px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" : ""
        }`}
      >
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={pending}>
          {last ? "Admit patient" : step === 1 && !abgEntered ? "Skip for now" : "Next"}
        </Button>
        {!last && (
          // Nothing is required, so a bed can be admitted from any step.
          <Button type="button" variant="ghost" loading={pending} onClick={save}>
            Admit now
          </Button>
        )}
      </div>
    </form>
  );
}
