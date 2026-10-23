"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/arc/button/button";
import EmptyState from "@/components/arc/empty-state/empty-state";
import { SearchField } from "@/components/arc/search-field/search-field";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { HUE, outcomeHue } from "@/lib/hues";
import { NO_DIAGNOSIS, ageText, isBlank } from "@/lib/display";
import { deleteArchivedAdmission } from "@/server/actions/patients";
import type { ClinicalRole } from "@/lib/permissions";
import { PatientDialog } from "./patient-dialog";
import { useAction } from "./use-action";
import { InlineError, Pill } from "./ui";
import { useToast } from "./toast-provider";

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

function DeleteArchiveButton({ admissionId, patient }: { admissionId: string; patient: string }) {
  const { run, pending, error } = useAction();
  const { toast } = useToast();
  return (
    <div className="grid gap-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        loading={pending}
        aria-label={`Delete archived record for ${patient}`}
        onClick={() => {
          if (!window.confirm(`Delete ${patient} from the archive permanently? This cannot be undone.`)) return;
          void run(
            () => deleteArchivedAdmission({ admissionId }),
            () => toast("Deleted from archive", patient),
          );
        }}
      >
        Delete
      </Button>
      <InlineError>{error}</InlineError>
    </div>
  );
}

export function ArchiveView({
  rows,
  total,
  page,
  pageSize,
  q,
  canDelete,
  role = "resident",
  uploadMode,
}: {
  rows: ArchiveRow[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  canDelete: boolean;
  role?: ClinicalRole;
  uploadMode: "presigned" | "proxy";
}) {
  const router = useRouter();
  const [term, setTerm] = useState(q);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = window.setTimeout(() => router.replace(term.trim() ? `/archive?q=${encodeURIComponent(term.trim())}` : "/archive"), 350);
    return () => window.clearTimeout(id);
  }, [term, router]);

  const columns = useMemo((): DataColumn<ArchiveRow>[] => {
    const cols: DataColumn<ArchiveRow>[] = [
      {
        key: "patient",
        label: "Patient",
        sortable: true,
        render: (_v, r) => (
          <Link
            href={`/patients/${r.id}`}
            className="font-medium underline-offset-2 hover:underline cursor-pointer"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              setActivePatientId(r.id);
            }}
          >
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
    if (canDelete) {
      cols.push({
        key: "delete",
        label: "Delete",
        render: (_v, r) => <DeleteArchiveButton admissionId={r.id} patient={r.patient} />,
      });
    }
    return cols;
  }, [canDelete]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => `/archive?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) }).toString()}`;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="w-full min-w-0 max-w-md">
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
          <ul className="grid min-w-0 gap-2 sm:hidden" aria-label="Discharged patients, newest first">
            {rows.map((r) => (
              <li key={r.id} className={`grid min-w-0 gap-2 rounded-xl border border-border bg-surface p-3 ${outcomeHue(r.outcome) ? HUE[outcomeHue(r.outcome)!].edge : "border-l-4 border-l-border-strong"}`}>
                <Link
                  href={`/patients/${r.id}`}
                  className="grid min-w-0 gap-1 hover:opacity-90 cursor-pointer"
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    setActivePatientId(r.id);
                  }}
                >
                  <span className="flex min-w-0 items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{r.patient}</span>
                    {r.age !== null && <span className="shrink-0 text-sm text-text-secondary">{ageText(r.age)}</span>}
                  </span>
                  <span className={`line-clamp-2 break-words text-sm ${isBlank(r.diagnosis) ? "text-text-muted" : ""}`}>{isBlank(r.diagnosis) ? NO_DIAGNOSIS : r.diagnosis}</span>
                  <span className="break-words text-sm text-text-secondary">
                    {r.ward}, {r.bed}. Discharged {r.discharged}
                  </span>
                  {r.outcome && (
                    <span className="min-w-0 text-sm">
                      <Pill hue={outcomeHue(r.outcome)}>{r.outcome}</Pill>
                    </span>
                  )}
                </Link>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-1.5">
                  <Link
                    href={`/print/patient/${r.id}`}
                    target="_blank"
                    className="inline-flex min-h-11 touch-manipulation items-center text-sm font-medium text-text-secondary underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Print record
                  </Link>
                  {canDelete && <DeleteArchiveButton admissionId={r.id} patient={r.patient} />}
                </div>
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
