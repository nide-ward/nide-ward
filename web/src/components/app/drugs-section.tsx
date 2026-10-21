"use client";

import { useState } from "react";
import Button from "@/components/arc/button/button";
import EmptyState from "@/components/arc/empty-state/empty-state";
import { Input } from "@/components/arc/input/input";
import { addMedication, removeMedication } from "@/server/actions/patients";
import { useChart } from "./chart-context";
import { useAction } from "./use-action";
import { InlineError, Panel } from "./ui";

export interface MedRow {
  id: string;
  name: string;
  dose: string;
  frequency: string;
}

export function DrugsSection({ meds }: { meds: MedRow[] }) {
  const chart = useChart();
  const { run, pending, error } = useAction();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [freq, setFreq] = useState("");
  const editable = chart.allowed("drugs.edit");

  return (
    <Panel hue="teal" title={`Concomitant drugs (${meds.length})`} description="Non-insulin medication. Insulin is in the regimen tab.">
      {meds.length === 0 ? (
        <EmptyState title="No other drugs listed" description={editable ? "Add antibiotics, anticoagulants or other medication below." : "Nothing has been prescribed besides insulin."} />
      ) : (
        <>
        {/* Phone: one row per drug, the remove button beside it. */}
        <ul className="grid divide-y divide-border rounded-xl border border-border sm:hidden" aria-label="Concomitant drugs">
          {meds.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-text-secondary">{[m.dose, m.frequency].filter(Boolean).join(", ") || "No dose recorded"}</p>
              </div>
              {editable && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Remove ${m.name}`}
                  onClick={() => void run(() => removeMedication({ admissionId: chart.admissionId, version: chart.version, medicationId: m.id }), (r) => chart.setVersion(r.version))}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="sr-only">Concomitant drugs</caption>
            <thead className="bg-surface-muted text-text-secondary">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Drug</th>
                <th scope="col" className="px-3 py-2 font-medium">Dose</th>
                <th scope="col" className="px-3 py-2 font-medium">Frequency</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {meds.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{m.name}</td>
                  <td className="tnum px-3 py-2">{m.dose}</td>
                  <td className="px-3 py-2">{m.frequency}</td>
                  <td className="px-3 py-2 text-right">
                    {editable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label={`Remove ${m.name}`}
                        onClick={() => void run(() => removeMedication({ admissionId: chart.admissionId, version: chart.version, medicationId: m.id }), (r) => chart.setVersion(r.version))}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      {editable && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () => addMedication({ admissionId: chart.admissionId, version: chart.version, name, dose, frequency: freq }),
              (r) => {
                chart.setVersion(r.version);
                setName("");
                setDose("");
                setFreq("");
              },
            );
          }}
        >
          <Input label="Drug name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Ceftriaxone" />
          <Input label="Dose" value={dose} onChange={(e) => setDose(e.target.value)} maxLength={60} placeholder="2g" />
          <Input label="Frequency" value={freq} onChange={(e) => setFreq(e.target.value)} maxLength={60} placeholder="IV once daily" />
          <Button type="submit" loading={pending}>
            Add drug
          </Button>
        </form>
      )}
      <div className="mt-3">
        <InlineError>{error}</InlineError>
      </div>
    </Panel>
  );
}
