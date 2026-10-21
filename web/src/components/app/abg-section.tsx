"use client";

import { useMemo, useState } from "react";
import Button from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { addAbgReading, deleteAbgReading } from "@/server/actions/abg";
import {
  abgWarnings,
  analyzeABG,
  calculateABGStatus,
  parseABGSlipText,
  parseMeasurement,
  shiftSummaryLine,
  type AbgEntry,
} from "@/lib/clinical";
import { normalizeNumericText } from "@/lib/numeric-input";
import { fromCairoInputValue, toCairoInputValue } from "@/lib/time";
import { EMPTY, FIELDS, type FieldKey } from "./abg-fields";
import { SlipScanner } from "./slip-scanner";
import { useChart } from "./chart-context";
import { useAction } from "./use-action";
import { fmtNum, InlineError, Panel, Pill } from "./ui";
import { useToast } from "./toast-provider";

export interface AbgRowData extends AbgEntry {
  id: string;
  takenAt: Date;
  hco3Std: number | null;
  recordedBy: string;
}

export const SLOTS = [3, 7, 11, 15, 19, 23];
export const slotLabel = (h: number) => `${String(h % 12 || 12).padStart(2, "0")}:00 ${h >= 12 ? "PM" : "AM"}`;

export { EMPTY, FIELDS, type FieldKey } from "./abg-fields";

/** Arrow for an abnormal value, with a screen reader word, so the colour is never the only signal. */
function Flag({ word }: { word: "low" | "high" }) {
  return (
    <>
      <span aria-hidden="true">{word === "low" ? " \u2193" : " \u2191"}</span>
      <span className="sr-only"> ({word})</span>
    </>
  );
}

function nowCairoValue() {
  return toCairoInputValue(new Date());
}

/** Time to the next fixed slot status badge. `now` is state so the first render matches the server. */
export function AbgDueBadge({ lastTakenAt, nowIso }: { lastTakenAt: Date | null; nowIso: string }) {
  const status = calculateABGStatus(lastTakenAt, new Date(nowIso));
  return (
    <Pill hue={status.isDue ? "rose" : "emerald"} dot pulse={status.isDue}>
      {status.isDue ? `${status.text} (overdue)` : status.text}
    </Pill>
  );
}

function Interpretation({ latest }: { latest: AbgRowData | null }) {
  const res = useMemo(() => analyzeABG(latest), [latest]);
  if (!latest) {
    return (
      <p className="text-sm text-text-secondary">
        No blood gas logged yet. Enter the measured values below to calculate anion gap, Winter&rsquo;s pCO2 range, delta ratio and the protocol shift criteria.
      </p>
    );
  }
  if (!res) return null;
  const warnings = abgWarnings(res);
  const summary = shiftSummaryLine(res);
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-muted p-3">
          <dt className="text-sm text-text-secondary">Anion gap</dt>
          <dd className={`tnum mt-0.5 ${res.isHighAG ? "text-hue-amber-ink" : ""}`}>
            {res.ag !== null ? `${res.ag} mmol/L (${res.isHighAG ? "elevated" : "normal"})` : "Unmeasured. Needs Na, Cl and HCO3."}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-muted p-3">
          <dt className="text-sm text-text-secondary">Winter&rsquo;s pCO2 target</dt>
          <dd className="tnum mt-0.5">{res.wintersMin !== null ? `${res.wintersMin} to ${res.wintersMax} mmHg` : "Incomplete. Needs HCO3."}</dd>
        </div>
        <div className="rounded-xl bg-surface-muted p-3">
          <dt className="text-sm text-text-secondary">Delta ratio</dt>
          <dd className="tnum mt-0.5">{res.deltaRatio !== null ? res.deltaRatio : res.ag === null ? "AG unmeasured" : "Not applicable"}</dd>
        </div>
      </dl>
      {warnings.length > 0 && (
        <ul className="grid gap-1 rounded-xl border border-warning px-3 py-2 text-sm" aria-label="Warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <div className="grid gap-1 text-sm">
        <p>
          <span className="font-medium">Diagnosis:</span> {res.diagnosis} (pH {res.ph ?? "unmeasured"}, HCO3 {res.hco3 ?? "unmeasured"}).
        </p>
        <p>
          <span className="font-medium">Respiratory compensation:</span> {res.respiratoryComp}.
        </p>
        {res.deltaRatioText && (
          <p>
            <span className="font-medium">Delta ratio:</span> {res.deltaRatioText}.
          </p>
        )}
        <p className={`pt-1 font-medium ${summary.ready ? "text-success" : "text-hue-rose-ink"}`}>{summary.text}</p>
      </div>
    </div>
  );
}

function EntryForm() {
  const chart = useChart();
  const { run, pending, error } = useAction();
  const { toast } = useToast();
  const [takenAt, setTakenAt] = useState(nowCairoValue);
  const [vals, setVals] = useState<Record<FieldKey, string>>(EMPTY);
  const [slip, setSlip] = useState("");
  const [slipMsg, setSlipMsg] = useState<string | null>(null);
  const [showSlip, setShowSlip] = useState(false);

  const setSlot = (hour: number) => {
    const date = nowCairoValue().slice(0, 10);
    setTakenAt(`${date}T${String(hour).padStart(2, "0")}:00`);
  };

  const applySlip = () => {
    const parsed = parseABGSlipText(slip);
    const found = Object.keys(parsed).length;
    setVals((v) => {
      const next = { ...v };
      for (const [k, val] of Object.entries(parsed)) {
        const key = (k === "hco3std" ? "hco3Std" : k) as FieldKey;
        next[key] = String(val);
      }
      return next;
    });
    setSlipMsg(found ? `${found} parameter${found === 1 ? "" : "s"} detected. Check them against the slip, then log the reading.` : "No values recognised. Check the pasted text.");
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const when = fromCairoInputValue(takenAt);
        const n = (k: FieldKey) => parseMeasurement(vals[k]);
        void run(
          () =>
            addAbgReading({
              admissionId: chart.admissionId,
              takenAt: when ? when.toISOString() : "",
              ph: n("ph"),
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
            }),
          () => {
            setVals(EMPTY);
            setSlip("");
            setSlipMsg(null);
            setTakenAt(nowCairoValue());
            toast("Blood gas logged");
          },
        );
      }}
    >
      <div className="grid gap-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Time drawn (Cairo)</span>
          <input className="native-field" type="datetime-local" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} required />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Scheduled draw times">
          <Button type="button" size="sm" variant="secondary" onClick={() => setTakenAt(nowCairoValue())}>
            Now
          </Button>
          {SLOTS.map((h) => (
            <Button key={h} type="button" size="sm" variant="secondary" onClick={() => setSlot(h)}>
              {slotLabel(h)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <SlipScanner
            onText={setSlip}
            onFallback={() => setShowSlip(true)}
            onApply={(found) => {
              setVals((v) => ({ ...v, ...found }));
              setSlipMsg(`${Object.keys(found).length} value${Object.keys(found).length === 1 ? "" : "s"} filled from the scan. Check them, then log the reading.`);
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
                Fill the form from slip
              </Button>
              {slipMsg && <span role="status" className="text-sm text-text-secondary">{slipMsg}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {FIELDS.map((f) => (
          <Input
            key={f.key}
            label={f.label}
            // Text, not type="number": number fields empty themselves on comma or Arabic-digit keyboards.
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={f.placeholder}
            value={vals[f.key]}
            onChange={(e) => setVals((v) => ({ ...v, [f.key]: normalizeNumericText(e.target.value) }))}
            required={f.key === "ph"}
          />
        ))}
      </div>
      <InlineError>{error}</InlineError>
      <div>
        <Button type="submit" loading={pending}>
          Log reading
        </Button>
      </div>
    </form>
  );
}

function ReadingsTable({ rows }: { rows: AbgRowData[] }) {
  const chart = useChart();
  const { run, pending, error } = useAction();
  const canDelete = chart.allowed("abg.delete");
  if (rows.length === 0) return <p className="text-sm text-text-secondary">No blood gas records logged yet.</p>;
  const onDelete = (r: AbgRowData) => {
    if (window.confirm("Delete this reading? It stays in the audit log.")) {
      void run(() => deleteAbgReading({ admissionId: chart.admissionId, abgId: r.id }));
    }
  };
  return (
    <div className="grid gap-2">
      {/* Phone: newest first, one card per reading, protocol values (pH, HCO3, AG) up front. */}
      <ul className="grid gap-2 sm:hidden" aria-label="Serial blood gas readings, newest first">
        {[...rows].reverse().map((r) => {
          const a = analyzeABG(r);
          const when = toCairoInputValue(r.takenAt).replace("T", " ");
          const rest: [string, string][] = [
            ["pCO2", fmtNum(r.pco2)],
            ["Winter's", a && a.wintersMin !== null ? `${a.wintersMin}-${a.wintersMax}` : "--"],
            ["RBG", fmtNum(r.rbg)],
            ["K", fmtNum(r.k)],
            ["Na", fmtNum(r.na)],
            ["pO2", fmtNum(r.po2)],
            ["Hb", fmtNum(r.hb)],
          ];
          return (
            <li
              key={r.id}
              className={`tnum rounded-xl border p-3 ${
                (r.ph !== null && r.ph !== undefined && r.ph < 7.35) || (r.hco3 !== null && r.hco3 !== undefined && r.hco3 < 18)
                  ? "border-hue-rose-line bg-hue-rose-soft"
                  : a?.isHighAG
                    ? "border-hue-amber-line bg-hue-amber-soft"
                    : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-text-secondary">{when}</span>
                {canDelete && (
                  <Button size="sm" variant="ghost" disabled={pending} aria-label={`Delete reading from ${when}`} onClick={() => onDelete(r)}>
                    Delete
                  </Button>
                )}
              </div>
              <dl className="mt-1 grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-xs text-text-secondary">pH</dt>
                  <dd className={`text-lg font-medium ${r.ph !== null && r.ph !== undefined && r.ph < 7.35 ? "text-hue-rose-ink" : ""}`}>{fmtNum(r.ph)}{r.ph !== null && r.ph !== undefined && r.ph < 7.35 && <Flag word="low" />}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">HCO3</dt>
                  <dd className={`text-lg font-medium ${r.hco3 !== null && r.hco3 !== undefined && r.hco3 < 18 ? "text-hue-rose-ink" : ""}`}>{fmtNum(r.hco3)}{r.hco3 !== null && r.hco3 !== undefined && r.hco3 < 18 && <Flag word="low" />}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-secondary">AG</dt>
                  <dd className={`text-lg font-medium ${a?.isHighAG ? "text-hue-amber-ink" : ""}`}>{a && a.ag !== null ? a.ag : "--"}{a?.isHighAG && <Flag word="high" />}</dd>
                </div>
              </dl>
              <dl className="mt-2 grid grid-cols-4 gap-x-2 gap-y-1 text-sm">
                {rest.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-text-secondary">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
        <table className="tnum w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Serial blood gas readings, oldest first</caption>
          <thead className="bg-surface-muted text-text-secondary">
            <tr>
              {["Time (Cairo)", "pH", "pCO2", "HCO3", "AG", "Winter's", "RBG", "K", "Na", "pO2", "Hb", ""].map((h, i) => (
                <th key={i} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                  {h || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = analyzeABG(r);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-3 py-2">{toCairoInputValue(r.takenAt).replace("T", " ")}</td>
                  <td className={`px-3 py-2 font-medium ${r.ph !== null && r.ph !== undefined && r.ph < 7.35 ? "text-hue-rose-ink" : ""}`}>{fmtNum(r.ph)}{r.ph !== null && r.ph !== undefined && r.ph < 7.35 && <Flag word="low" />}</td>
                  <td className="px-3 py-2">{fmtNum(r.pco2)}</td>
                  <td className={`px-3 py-2 font-medium ${r.hco3 !== null && r.hco3 !== undefined && r.hco3 < 18 ? "text-hue-rose-ink" : ""}`}>{fmtNum(r.hco3)}{r.hco3 !== null && r.hco3 !== undefined && r.hco3 < 18 && <Flag word="low" />}</td>
                  <td className={`px-3 py-2 ${a?.isHighAG ? "text-hue-amber-ink" : ""}`}>{a && a.ag !== null ? a.ag : "--"}{a?.isHighAG && <Flag word="high" />}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">{a && a.wintersMin !== null ? `${a.wintersMin}-${a.wintersMax}` : "--"}</td>
                  <td className="px-3 py-2">{fmtNum(r.rbg)}</td>
                  <td className="px-3 py-2">{fmtNum(r.k)}</td>
                  <td className="px-3 py-2">{fmtNum(r.na)}</td>
                  <td className="px-3 py-2">{fmtNum(r.po2)}</td>
                  <td className="px-3 py-2">{fmtNum(r.hb)}</td>
                  <td className="px-3 py-2 text-right">
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label={`Delete reading from ${toCairoInputValue(r.takenAt).replace("T", " ")}`}
                        onClick={() => onDelete(r)}
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <InlineError>{error}</InlineError>
    </div>
  );
}

export function AbgSection({ rows, nowIso }: { rows: AbgRowData[]; nowIso: string }) {
  const chart = useChart();
  const latest = rows.length ? rows[rows.length - 1] : null;
  return (
    <div className="grid gap-4">
      <Panel
        hue="sky"
        title="Latest interpretation"
        action={
          rows.length === 0 ? (
            <Pill>Next: on intake</Pill>
          ) : (
            <AbgDueBadge lastTakenAt={latest ? latest.takenAt : null} nowIso={nowIso} />
          )
        }
      >
        <Interpretation latest={latest} />
      </Panel>
      {chart.allowed("abg.record") && (
        <Panel hue="sky" title="Log a reading" description="Scheduled draws are 03:00, 07:00, 11:00, 15:00, 19:00 and 23:00.">
          <EntryForm />
        </Panel>
      )}
      <Panel hue="sky" title={`Blood gas log (${rows.length})`}>
        <ReadingsTable rows={rows} />
      </Panel>
    </div>
  );
}
