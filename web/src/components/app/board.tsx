"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { FileText, UserPlus } from "lucide-react";
import EmptyState from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import { analyzeABG } from "@/lib/clinical";
import { NO_DIAGNOSIS, ageText, isBlank, patientLabel } from "@/lib/display";
import { BED_TYPE_HUE, HUE, wardHue } from "@/lib/hues";
import { toCairoInputValue } from "@/lib/time";
import { can, type ClinicalRole } from "@/lib/permissions";
import type { BoardBed, BoardWard } from "@/server/queries";

import { AdmitDialog, type AdmitTarget } from "./admit-dialog";
import { PatientDialog } from "./patient-dialog";
import { Pill } from "./ui";

const TYPE_LABEL: Record<BoardBed["type"], string> = { regular: "Standard", extra: "Extra", paid: "Private", overflow: "Surge" };

const HEADER_ACTION =
  "inline-flex min-h-11 flex-1 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-teal-600 px-3.5 py-2 text-sm font-bold text-white shadow-xs transition hover:bg-teal-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-secondary disabled:shadow-none disabled:hover:bg-surface-muted disabled:active:scale-100 sm:flex-initial";

interface CardProps {
  bed: BoardBed;
  ward: BoardWard;
  onOpenPatient: (admissionId: string) => void;
}

function BedCard({ bed, ward, onOpenPatient }: CardProps) {
  const hue = wardHue(ward.id);
  const h = HUE[hue];
  const typePill = <Pill hue={BED_TYPE_HUE[bed.type]}>{TYPE_LABEL[bed.type]}</Pill>;
  const a = bed.admission;

  if (!a) return null;

  const latest = a.latestAbg;
  const analysis = analyzeABG(latest);
  const nameBlank = isBlank(a.patientName);
  const who = patientLabel(a.patientName);

  return (
    <Link
      href={`/patients/${a.id}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onOpenPatient(a.id);
      }}
      className={`w-full min-w-0 max-w-full overflow-hidden flex flex-col justify-between rounded-2xl border min-h-[175px] shadow-xs hover:shadow-md transition-all cursor-pointer ${h.card}`}
      aria-label={`${bed.name}, ${who}. Open chart`}
    >
      <div className={`flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border/40 ${h.band}`}>
        <span className={`text-xs font-bold uppercase tracking-wider ${h.ink}`}>{bed.name}</span>
        {typePill}
      </div>

      <div className="p-3.5 flex flex-col justify-between flex-1 gap-2">
        <div className="grid gap-1 min-w-0 w-full overflow-hidden">
          <p className={`truncate text-sm sm:text-base font-bold text-foreground ${nameBlank ? "text-text-secondary" : ""}`}>{who}</p>
          <div className="flex items-center justify-between gap-2 text-xs font-medium text-text-secondary">
            <span className="shrink-0">{ageText(a.age) || "--"}</span>
            <span className="min-w-0 truncate">{isBlank(a.diagnosis) ? NO_DIAGNOSIS : a.diagnosis}</span>
          </div>
          {latest && (
            <div className="tnum mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-border/60 bg-surface-muted/60 px-2 py-1 text-xs">
              <span>
                pH <b className={latest.ph !== null && latest.ph < 7.35 ? "font-bold text-rose-600 dark:text-rose-400" : "font-bold"}>{latest.ph ?? "--"}</b>
              </span>
              <span>
                HCO3 <b className="font-bold">{latest.hco3 ?? "--"}</b>
              </span>
              <span>
                AG <b className={`font-bold ${analysis?.isHighAG ? "text-amber-600 dark:text-amber-400" : ""}`}>{analysis && analysis.ag !== null ? analysis.ag : "--"}</b>
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
          <Pill hue="purple">Lantus {a.basalUnits}U</Pill>
          {a.mediaCount > 0 && <Pill hue="cyan">{a.mediaCount} lab photo{a.mediaCount === 1 ? "" : "s"}</Pill>}
        </div>

        <div className="border-t border-border/50 pt-2 flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span aria-hidden="true" className={`size-2 rounded-full ${h.dot}`} />
            Occupied
          </span>
          <span className="text-teal-600 font-bold hover:text-teal-700 flex items-center gap-0.5">Chart &rarr;</span>
        </div>
      </div>
    </Link>
  );
}

/** Ward tabs: a 2 by 2 grid on phones, one row from `sm`, each in its ward's colour. */
function WardTabs({ wards, value, onChange }: { wards: BoardWard[]; value: string; onChange: (id: string) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? i + 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? wards.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const w = wards[(next + wards.length) % wards.length];
    onChange(w.id);
    refs.current[w.id]?.focus();
  };
  return (
    <div role="tablist" aria-label="Wards" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {wards.map((w, i) => {
        const on = w.id === value;
        const hue = wardHue(w.id);
        return (
          <button
            key={w.id}
            ref={(el) => {
              refs.current[w.id] = el;
            }}
            type="button"
            role="tab"
            id={`ward-tab-${w.id}`}
            aria-selected={on}
            aria-controls={`ward-panel-${w.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(w.id)}
            onKeyDown={(e) => move(e, i)}
            className={`flex min-h-12 min-w-0 touch-manipulation items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium sm:px-3.5 ${
              on ? HUE[hue].solid : "border-border bg-surface hover:bg-surface-muted"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${on ? "bg-hue-on" : HUE[hue].dot}`} />
              <span className="truncate">{w.title}</span>
            </span>
            <span className={`tnum shrink-0 rounded-md px-1.5 py-0.5 text-xs ${on ? "bg-hue-on/20" : "bg-surface-muted text-text-secondary"}`}>
              {w.beds.filter((b) => b.admission).length}/{w.beds.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Board({ wards, role, uploadMode }: { wards: BoardWard[]; role: ClinicalRole; uploadMode: "presigned" | "proxy" }) {
  const [ward, setWard] = useState(wards[0]?.id ?? "female");
  const [query, setQuery] = useState("");
  const [admitTarget, setAdmitTarget] = useState<AdmitTarget | null>(null);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const total = wards.reduce((n, w) => n + w.beds.length, 0);
  const occupied = wards.reduce((n, w) => n + w.beds.filter((b) => b.admission).length, 0);
  const canAdmit = can(role, "patient.admit");

  const openAdmit = useCallback((bed: BoardBed, w: BoardWard) => {
    setAdmitTarget({ bedId: bed.id, bedName: bed.name, bedTypeLabel: TYPE_LABEL[bed.type], wardId: w.id, wardTitle: w.title, openedAt: toCairoInputValue(new Date()) });
  }, []);
  const closeAdmit = useCallback(() => setAdmitTarget(null), []);

  const visible = useMemo(() => {
    const s = query.trim().toLowerCase();
    return (w: BoardWard) =>
      w.beds.filter((b) => {
        const a = b.admission;
        if (!a) return false;
        if (s) {
          const hit =
            b.name.toLowerCase().includes(s) ||
            b.id.toLowerCase().includes(s) ||
            a.patientName.toLowerCase().includes(s) ||
            a.diagnosis.toLowerCase().includes(s) ||
            (isBlank(a.patientName) && "unnamed patient".includes(s));
          if (!hit) return false;
        }
        return true;
      });
  }, [query]);

  const active = wards.find((w) => w.id === ward) ?? wards[0];
  const firstFreeBed = active?.beds.find((bed) => !bed.admission);

  return (
    <div className="w-full min-w-0 max-w-full grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ward board</h1>
          <p className="tnum flex items-center gap-2 text-text-secondary text-sm">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-emerald-500" />
            <span>
              Census: <b className="text-foreground">{occupied}</b> of {total} beds occupied
            </span>
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {canAdmit && (
            <button
              type="button"
              onClick={() => firstFreeBed && active && openAdmit(firstFreeBed, active)}
              disabled={!firstFreeBed}
              className={HEADER_ACTION}
            >
              <UserPlus size={16} aria-hidden="true" />
              <span>{firstFreeBed ? "Admit patient" : "Full capacity"}</span>
            </button>
          )}
          <Link
            href="/print/census"
            target="_blank"
            className={HEADER_ACTION}
            title="Print entire inpatient census from all floors"
          >
            <FileText size={16} aria-hidden="true" className="shrink-0" />
            <span>Print all floors</span>
          </Link>
        </div>
      </div>

      <div className="w-full min-w-0 max-w-full">
        <SearchField label="Search bed, patient or diagnosis" value={query} onValueChange={setQuery} />
      </div>

      <WardTabs wards={wards} value={active.id} onChange={setWard} />

      {wards.map((w) => {
        const beds = visible(w);
        const hue = wardHue(w.id);
        const h = HUE[hue];
        return (
          <div key={w.id} role="tabpanel" id={`ward-panel-${w.id}`} aria-labelledby={`ward-tab-${w.id}`} hidden={w.id !== active.id} className="w-full min-w-0 max-w-full grid gap-3">
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${h.panel}`}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden="true" className={`size-3 shrink-0 rounded-full ${h.dot}`} />
                <div className="min-w-0">
                  <h2 className={`text-base font-medium ${h.ink}`}>{w.title}</h2>
                  <p className={`text-sm ${h.ink}`}>{w.description}</p>
                </div>
              </div>
            </div>
            {beds.length === 0 ? (
              <div className={`rounded-2xl border ${h.panel}`}>
                <EmptyState
                  title={w.beds.some((bed) => bed.admission) ? "No patients match" : "No patients on this ward"}
                  description={w.beds.some((bed) => bed.admission) ? "Clear the search to see this ward again." : canAdmit ? "Use Admit patient to add one." : "Patients appear here once admitted."}
                />
              </div>
            ) : (
              <div className="w-full min-w-0 max-w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {beds.map((b) => (
                  <BedCard
                    key={b.id}
                    bed={b}
                    ward={w}
                    onOpenPatient={setActivePatientId}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {canAdmit && <AdmitDialog target={admitTarget} onClose={closeAdmit} />}
      {activePatientId && (
        <PatientDialog
          admissionId={activePatientId}
          role={role}
          uploadMode={uploadMode}
          onClose={() => setActivePatientId(null)}
        />
      )}
    </div>
  );
}
