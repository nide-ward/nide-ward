"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import EmptyState from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import { HUE, outcomeHue } from "@/lib/hues";
import { Pill } from "./ui";
import { NO_DIAGNOSIS, ageText, isBlank } from "@/lib/display";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";

export interface ArchiveRow extends Record<string, unknown> {
  id: string;
  patient: string;
  age: number | null;
  bed: string;
  ward: string;
  admitted: string;
  discharged: string;
  outcome: string;
  diagnosis: string;
  lastAbg: string;
  insulin: string;
}

const columns: DataColumn<ArchiveRow>[] = [
  {
    key: "patient",
    label: "Patient",
    sortable: true,
    render: (_v, r) => (
      <Link href={`/patients/${r.id}`} className="font-medium underline-offset-2 hover:underline">
        {r.patient}
      </Link>
    ),
  },
  { key: "age", label: "Age", numeric: true, width: 72, render: (_v, r) => (r.age === null ? "" : r.age) },
  { key: "bed", label: "Bed", sortable: true, width: 100 },
  {
    key: "diagnosis",
    label: "Diagnosis",
    sortable: true,
    render: (_v, r) => (isBlank(r.diagnosis) ? <span className="text-text-muted">{NO_DIAGNOSIS}</span> : r.diagnosis),
  },
  { key: "admitted", label: "Admitted", sortable: true },
  { key: "discharged", label: "Discharged", sortable: true },
  {
    key: "outcome",
    label: "Outcome",
    sortable: true,
    render: (_v, r) => (r.outcome ? <Pill hue={outcomeHue(r.outcome)}>{r.outcome}</Pill> : ""),
  },
  { key: "lastAbg", label: "Final blood gas" },
  { key: "insulin", label: "Insulin" },
  {
    key: "print",
    label: "Print",
    render: (_v, r) => (
      <Link href={`/print/patient/${r.id}`} target="_blank" className="underline-offset-2 hover:underline">
        Print record
      </Link>
    ),
  },
];

export function ArchiveView({ rows, total, page, pageSize, q }: { rows: ArchiveRow[]; total: number; page: number; pageSize: number; q: string }) {
  const router = useRouter();
  const [term, setTerm] = useState(q);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = window.setTimeout(() => router.replace(term.trim() ? `/archive?q=${encodeURIComponent(term.trim())}` : "/archive"), 350);
    return () => window.clearTimeout(id);
  }, [term, router]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => `/archive?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) }).toString()}`;

  return (
    <div className="grid gap-4">
      <div className="max-w-md">
        <SearchField label="Search name, diagnosis, bed or discharge date" value={term} onValueChange={setTerm} />
      </div>
      {rows.length === 0 ? (
<div className="rounded-2xl border border-hue-teal-line bg-hue-teal-soft">
        <EmptyState
          title={q ? "No archived discharges match" : "No archived discharges yet"}
          description={q ? "Try a different name, bed or date such as 2026-10." : "Patients you discharge from the ward board are kept here."}
        />
</div>
      ) : (
        <>
        {/* Phone: one card per discharge, newest first (the order the server returns). */}
        <ul className="grid gap-2 sm:hidden" aria-label="Discharged patients, newest first">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/patients/${r.id}`} className={`grid gap-1 rounded-xl border border-border bg-surface p-3 hover:border-border-strong ${outcomeHue(r.outcome) ? HUE[outcomeHue(r.outcome)!].edge : "border-l-4 border-l-border-strong"}`}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{r.patient}</span>
                  {r.age !== null && <span className="shrink-0 text-sm text-text-secondary">{ageText(r.age)}</span>}
                </span>
                <span className={`line-clamp-2 text-sm ${isBlank(r.diagnosis) ? "text-text-muted" : ""}`}>{isBlank(r.diagnosis) ? NO_DIAGNOSIS : r.diagnosis}</span>
                <span className="text-sm text-text-secondary">
                  {r.ward}, {r.bed}. Discharged {r.discharged}
                </span>
                {r.outcome && (
                  <span className="text-sm">
                    <Pill hue={outcomeHue(r.outcome)}>{r.outcome}</Pill>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <SortableDataTable<ArchiveRow>
            rows={rows}
            columns={columns}
            rowKey="id"
            caption="Discharged patients, newest first"
            itemName={{ one: "discharge", other: "discharges" }}
            defaultSort={{ key: "discharged", direction: "desc" }}
          />
        </div>
        </>
      )}
      <nav aria-label="Archive pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="tnum text-text-secondary">
          {total} record{total === 1 ? "" : "s"}. Page {page} of {pages}
        </span>
        <span className="flex gap-2">
          {page > 1 && (
            <Link href={href(page - 1)} className="inline-flex min-h-11 items-center rounded-xl border border-border-strong px-4 hover:bg-surface-muted">
              Previous
            </Link>
          )}
          {page < pages && (
            <Link href={href(page + 1)} className="inline-flex min-h-11 items-center rounded-xl border border-border-strong px-4 hover:bg-surface-muted">
              Next
            </Link>
          )}
        </span>
      </nav>
    </div>
  );
}
