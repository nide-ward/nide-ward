"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText } from "lucide-react";
import EmptyState from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { SearchField } from "@/components/arc/search-field/search-field";
import { analyzeABG, calculateABGStatus } from "@/lib/clinical";
import { NO_DIAGNOSIS, ageText, isBlank, patientLabel } from "@/lib/display";
import { BED_TYPE_HUE, HUE, wardHue } from "@/lib/hues";
import { toCairoInputValue } from "@/lib/time";
import { can, type ClinicalRole } from "@/lib/permissions";
import type { BoardBed, BoardWard } from "@/server/queries";

import { AdmitDialog, type AdmitTarget } from "./admit-dialog";
import { PatientDialog } from "./patient-dialog";
import { Pill } from "./ui";

const TYPE_LABEL: Record<BoardBed["type"], string> = { regular: "Standard", extra: "Extra", paid: "Private", overflow: "Surge" };

interface CardProps {
  bed: BoardBed;
  ward: BoardWard;
  now: Date;
  canAdmit: boolean;
  onAdmit: (bed: BoardBed, ward: BoardWard) => void;
  onOpenPatient: (admissionId: string) => void;
}

function BedCard({ bed, ward, now, canAdmit, onAdmit, onOpenPatient }: CardProps) {
  const hue = wardHue(ward.id);
  const h = HUE[hue];
  const typePill = <Pill hue={BED_TYPE_HUE[bed.type]}>{TYPE_LABEL[bed.type]}</Pill>;
  const a = bed.admission;

  if (!a) {
    const emptyCard = (
      <div className="flex flex-col justify-between flex-1 p-3.5 gap-2">
        <div className="py-4 text-center my-auto">
          <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">Available bed</p>
          <p className="text-xs text-text-secondary">Ready for intake</p>
        </div>
        <div className="border-t border-border/50 pt-2 flex items-center justify-between text-xs font-semibold">
          <span className="text-text-secondary">Ready for intake</span>
          {canAdmit ? (
            <span className="rounded-lg bg-teal-600 px-2.5 py-1 font-bold text-white shadow-xs">+ Admit</span>
          ) : (
            <span className="text-text-secondary">Empty</span>
          )}
        </div>
      </div>
    );

    const emptyWrapper = `w-full min-w-0 max-w-full overflow-hidden flex flex-col justify-between rounded-2xl border min-h-[175px] shadow-xs hover:shadow-md transition-all cursor-pointer ${h.edge} ${h.hover}`;

    return canAdmit ? (
      <Link
        href={`/beds/${bed.id}/admit`}
        className={emptyWrapper}
        aria-label={`${bed.name}, available. Admit patient`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onAdmit(bed, ward);
        }}
      >
        <div className={`flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border/40 ${h.band}`}>
          <span className={`text-xs font-bold uppercase tracking-wider ${h.ink}`}>{bed.name}</span>
          {typePill}
        </div>
        {emptyCard}
      </Link>
    ) : (
      <div className={emptyWrapper}>
        <div className={`flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border/40 ${h.band}`}>
          <span className={`text-xs font-bold uppercase tracking-wider ${h.ink}`}>{bed.name}</span>
          {typePill}
        </div>
        {emptyCard}
      </div>
    );
  }

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
            <span>{ageText(a.age) || "--"}</span>
            <span className="truncate max-w-[150px]">{isBlank(a.diagnosis) ? NO_DIAGNOSIS : a.diagnosis}</span>
          </div>
          {latest && (
            <div className="tnum mt-1 flex items-center justify-between rounded-lg border border-border/60 bg-surface-muted/60 px-2 py-1 text-xs">
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
            className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-left text-sm font-medium ${
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

type Filter = "all" | "occupied";

export function Board({ wards, role, nowIso }: { wards: BoardWard[]; role: ClinicalRole; nowIso: string }) {
  const [ward, setWard] = useState(wards[0]?.id ?? "female");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [admitTarget, setAdmitTarget] = useState<AdmitTarget | null>(null);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  // `now` starts as the server's time so markup matches on hydration, then ticks locally.
  const [local, setLocal] = useState<Date | null>(null);
  const now = useMemo(() => local ?? new Date(nowIso), [local, nowIso]);
  useEffect(() => {
    const id = window.setInterval(() => setLocal(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

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
        if (s) {
          const hit =
            b.name.toLowerCase().includes(s) ||
            b.id.toLowerCase().includes(s) ||
            (a && (a.patientName.toLowerCase().includes(s) || a.diagnosis.toLowerCase().includes(s) || (isBlank(a.patientName) && "unnamed patient".includes(s))));
          if (!hit) return false;
        }
        if (filter === "occupied" && !a) return false;
        return true;
      });
  }, [query, filter]);

  const active = wards.find((w) => w.id === ward) ?? wards[0];

  return (
    <div className="w-full min-w-0 max-w-full grid gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ward board</h1>
          <p className="tnum flex items-center gap-2 text-text-secondary text-sm">
            <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
            Census: <b className="text-foreground">{occupied}</b> of {total} beds occupied
          </p>
        </div>
        <Link
          href="/print/census"
          target="_blank"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold px-3.5 py-2 text-xs shadow-xs transition active:scale-95 whitespace-nowrap"
          title="Print entire inpatient census from all floors"
        >
          <FileText size={16} aria-hidden="true" />
          <span>Print All Floors (.PDF Census)</span>
        </Link>
      </div>

      <div className="w-full min-w-0 max-w-full grid gap-3 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end">
        <SearchField label="Search bed, patient or diagnosis" value={query} onValueChange={setQuery} />
        <SegmentedControl
          label="Filter beds"
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          options={[
            { value: "all", label: "All beds" },
            { value: "occupied", label: "Occupied only" },
          ]}
        />
      </div>

      <WardTabs wards={wards} value={active.id} onChange={setWard} />

      {wards.map((w) => {
        const beds = visible(w);
        const hue = wardHue(w.id);
        const h = HUE[hue];
        return (
          <div key={w.id} role="tabpanel" id={`ward-panel-${w.id}`} aria-labelledby={`ward-tab-${w.id}`} hidden={w.id !== active.id} className="w-full min-w-0 max-w-full grid gap-3">
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${h.panel}`}>
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className={`size-3 rounded-full ${h.dot}`} />
                <div>
                  <h2 className={`text-base font-medium ${h.ink}`}>{w.title}</h2>
                  <p className={`text-sm ${h.ink}`}>{w.description}</p>
                </div>
              </div>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary font-medium" aria-label="Key">
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
                  Available
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={`size-2 rounded-full ${h.dot}`} />
                  Occupied
                </li>
              </ul>
            </div>
            {beds.length === 0 ? (
              <div className={`rounded-2xl border ${h.panel}`}>
                <EmptyState title="No beds match" description="Clear the search or choose a different filter to see this ward again." />
              </div>
            ) : (
              <div className="w-full min-w-0 max-w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {beds.map((b) => (
                  <BedCard
                    key={b.id}
                    bed={b}
                    ward={w}
                    now={now}
                    canAdmit={canAdmit}
                    onAdmit={openAdmit}
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
          onClose={() => setActivePatientId(null)}
        />
      )}
    </div>
  );
}
