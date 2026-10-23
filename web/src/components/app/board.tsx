"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Pill } from "./ui";

const TYPE_LABEL: Record<BoardBed["type"], string> = { regular: "Standard", extra: "Extra", paid: "Private", overflow: "Surge" };

interface CardProps {
  bed: BoardBed;
  ward: BoardWard;
  now: Date;
  canAdmit: boolean;
  onAdmit: (bed: BoardBed, ward: BoardWard) => void;
}

function BedCard({ bed, ward, now, canAdmit, onAdmit }: CardProps) {
  const hue = wardHue(ward.id);
  const h = HUE[hue];
  const typePill = <Pill hue={BED_TYPE_HUE[bed.type]}>{TYPE_LABEL[bed.type]}</Pill>;
  const a = bed.admission;
  if (!a) {
    // Phone: one compact row per empty bed. From `sm` up: a card the same size as an occupied bed.
    const empty = `flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 ${h.edge} ${h.hover} sm:min-h-44 sm:flex-col sm:items-stretch sm:p-4`;
    const inner = (
      <>
        <div className="flex min-w-0 items-center gap-2 sm:justify-between">
          <span className="font-medium">{bed.name}</span>
          {typePill}
        </div>
        <div className="hidden py-4 text-center sm:block">
          <p className="font-medium text-hue-emerald-ink">Available bed</p>
          <p className="text-sm text-text-secondary">Ready for intake</p>
        </div>
        <p className="flex shrink-0 items-center gap-3 text-sm">
          <span className="font-medium text-hue-emerald-ink sm:hidden">Available</span>
          {canAdmit && <span className="rounded-lg bg-accent px-2.5 py-1 font-medium text-accent-foreground sm:hidden">Admit</span>}
          <span className={`hidden font-medium sm:inline ${canAdmit ? "text-accent-strong" : "text-text-secondary"}`}>{canAdmit ? "+ Admit patient" : "Empty"}</span>
        </p>
      </>
    );
    return canAdmit ? (
      // A real link, so a direct open or new tab still reaches the admit page; a plain tap opens the dialog instead.
      <Link
        href={`/beds/${bed.id}/admit`}
        className={empty}
        aria-label={`${bed.name}, available. Admit patient`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onAdmit(bed, ward);
        }}
      >
        {inner}
      </Link>
    ) : (
      <div className={empty}>{inner}</div>
    );
  }

  const latest = a.latestAbg;
  const analysis = analyzeABG(latest);
  const status = calculateABGStatus(latest ? latest.takenAt : null, now);
  const nameBlank = isBlank(a.patientName);
  const who = patientLabel(a.patientName);
  return (
    <Link
      href={`/patients/${a.id}`}
      className={`flex flex-col justify-between rounded-2xl border p-4 sm:min-h-44 ${h.card}`}
      aria-label={`${bed.name}, ${who}. Open chart`}
    >
      <div className="grid gap-1">
        {/* Header band in the ward's colour, as the prototype tints its occupied beds. */}
        <div className={`-mx-4 -mt-4 mb-1 flex items-center justify-between gap-2 rounded-t-xl px-4 py-2 ${h.band}`}>
          <span className={`font-medium ${h.ink}`}>{bed.name}</span>
          {typePill}
        </div>
        <p className={`truncate text-base font-medium ${nameBlank ? "text-text-secondary" : ""}`}>{who}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
          <span>{ageText(a.age)}</span>
        </div>
        <p className={`line-clamp-2 text-sm ${isBlank(a.diagnosis) ? "text-text-muted" : ""}`}>{isBlank(a.diagnosis) ? NO_DIAGNOSIS : a.diagnosis}</p>
        {latest && (
          <p className="tnum mt-1 flex flex-wrap justify-between gap-x-3 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm">
            <span>
              pH <b className={latest.ph !== null && latest.ph < 7.35 ? "font-medium text-hue-rose-ink" : "font-medium"}>{latest.ph ?? "--"}</b>
            </span>
            <span>
              HCO3 <b className="font-medium">{latest.hco3 ?? "--"}</b>
            </span>
            <span>
              AG <b className={`font-medium ${analysis?.isHighAG ? "text-hue-amber-ink" : ""}`}>{analysis && analysis.ag !== null ? analysis.ag : "--"}</b>
            </span>
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill hue="purple">Lantus {a.basalUnits}U</Pill>
        {a.mediaCount > 0 && <Pill hue="cyan">{a.mediaCount} lab photo{a.mediaCount === 1 ? "" : "s"}</Pill>}
      </div>
      <p className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span aria-hidden="true" className={`size-1.5 rounded-full ${h.dot}`} />
          Occupied
        </span>
        <span className="text-accent-strong">Chart &rarr;</span>
      </p>
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

type Filter = "all" | "occupied" | "abg-due" | "shift-ready";

export function Board({ wards, role, nowIso }: { wards: BoardWard[]; role: ClinicalRole; nowIso: string }) {
  const [ward, setWard] = useState(wards[0]?.id ?? "female");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [admitTarget, setAdmitTarget] = useState<AdmitTarget | null>(null);
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
        if (filter === "abg-due") {
          if (!a) return false;
          if (!calculateABGStatus(a.latestAbg ? a.latestAbg.takenAt : null, now).isDue) return false;
        }
        if (filter === "shift-ready") {
          if (!a || !analyzeABG(a.latestAbg)?.isShiftReady) return false;
        }
        return true;
      });
  }, [query, filter, now]);

  const active = wards.find((w) => w.id === ward) ?? wards[0];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">Ward board</h1>
          <p className="tnum flex items-center gap-2 text-text-secondary">
            <span aria-hidden="true" className="size-2 rounded-full bg-hue-emerald" />
            Census: {occupied} of {total} beds occupied
          </p>
        </div>
        <Link href="/print/census" target="_blank" className="hidden min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-strong hover:text-background sm:inline-flex">
          Print ward census
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end">
        <SearchField label="Search bed, patient or diagnosis" value={query} onValueChange={setQuery} />
        <SegmentedControl
          label="Filter beds"
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          options={[
            { value: "all", label: "All beds" },
            { value: "occupied", label: "Occupied" },
            { value: "abg-due", label: "ABG due" },
            { value: "shift-ready", label: "Shift ready" },
          ]}
        />
      </div>

      <WardTabs wards={wards} value={active.id} onChange={setWard} />

      {wards.map((w) => {
        const beds = visible(w);
        const hue = wardHue(w.id);
        const h = HUE[hue];
        return (
          <div key={w.id} role="tabpanel" id={`ward-panel-${w.id}`} aria-labelledby={`ward-tab-${w.id}`} hidden={w.id !== active.id} className="grid gap-3">
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${h.panel}`}>
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className={`size-3 rounded-full ${h.dot}`} />
                <div>
                  <h2 className={`text-base font-medium ${h.ink}`}>{w.title}</h2>
                  <p className={`text-sm ${h.ink}`}>{w.description}</p>
                </div>
              </div>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary" aria-label="Key">
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-hue-emerald" />
                  Available
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={`size-2 rounded-full ${h.dot}`} />
                  Occupied
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 rounded-full bg-hue-rose motion-safe:animate-pulse" />
                  ABG overdue
                </li>
              </ul>
            </div>
            {beds.length === 0 ? (
              <div className={`rounded-2xl border ${h.panel}`}>
                <EmptyState title="No beds match" description="Clear the search or choose a different filter to see this ward again." />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {beds.map((b) => (
                  <BedCard key={b.id} bed={b} ward={w} now={now} canAdmit={canAdmit} onAdmit={openAdmit} />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {canAdmit && <AdmitDialog target={admitTarget} onClose={closeAdmit} />}
    </div>
  );
}
