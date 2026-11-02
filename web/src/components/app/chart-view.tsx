"use client";

import { useRouter } from "next/navigation";
import Alert from "@/components/arc/alert/alert";
import Button from "@/components/arc/button/button";
import HoldToConfirm from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { outcomeHue, wardHue, HUE } from "@/lib/hues";
import { PrintPatientButton } from "./print-frame-buttons";
import { NO_DIAGNOSIS, ageText, isBlank, patientLabel } from "@/lib/display";
import { deleteArchivedAdmission, readmitPatient } from "@/server/actions/patients";
import { can, type ClinicalRole } from "@/lib/permissions";
import { formatCairo } from "@/lib/time";
import { AbgSection, type AbgRowData } from "./abg-section";
import { ChartProvider, useChart } from "./chart-context";
import { DischargeDialog } from "./discharge-dialog";
import { TransferDialog } from "./transfer-dialog";
import { DrugsSection, type MedRow } from "./drugs-section";
import { FileText } from "lucide-react";
import { InsulinSection, type InsulinData } from "./insulin-section";
import { MediaSection, type MediaRow } from "./media-section";
import { OverviewSection, type OverviewData } from "./overview-section";
import { PlanSection } from "./plan-section";
import { ProtocolPills } from "./protocol-pills";
import { useAction } from "./use-action";
import { InlineError, Pill } from "./ui";
import { useToast } from "./toast-provider";

export interface ChartViewProps {
  admissionId: string;
  serverVersion: number;
  role: ClinicalRole;
  uploadMode: "presigned" | "proxy";
  nowIso: string;
  bedName: string;
  wardTitle: string;
  wardId: string;
  discharged: null | { at: Date; by: string; outcome: string; notes: string; attending: string };
  overview: OverviewData;
  abgs: AbgRowData[];
  insulin: InsulinData;
  meds: MedRow[];
  media: MediaRow[];
  onDischarged?: () => void;
}

function StaleBanner() {
  const chart = useChart();
  return (
    <Alert tone="warning" title="Someone else updated this chart" open={chart.stale}>
      <div className="mt-2">
        <Button size="sm" variant="secondary" onClick={chart.reload}>
          Load the latest chart
        </Button>
      </div>
    </Alert>
  );
}

function ArchiveActions({ patientName }: { patientName: string }) {
  const chart = useChart();
  const router = useRouter();
  const { toast } = useToast();
  const readmit = useAction();
  const remove = useAction();
  if (!chart.readOnly) return null;
  const canReadmit = can(chart.role, "archive.readmit");
  const canDelete = can(chart.role, "archive.delete");
  if (!canReadmit && !canDelete) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
      {canReadmit && (
        <div className="grid gap-2">
          <Button
            variant="secondary"
            loading={readmit.pending}
            onClick={() => void readmit.run(() => readmitPatient({ admissionId: chart.admissionId }), () => toast("Patient re-admitted to the original bed"))}
          >
            Re-admit to bed
          </Button>
          <InlineError>{readmit.error}</InlineError>
        </div>
      )}
      {canDelete && (
        <div className="grid gap-2">
          <HoldToConfirm
            tone="danger"
            label="Hold to delete from archive"
            confirmedLabel="Deleted"
            onConfirm={() =>
              void remove.run(
                () => deleteArchivedAdmission({ admissionId: chart.admissionId }),
                () => {
                  toast("Deleted from archive", patientLabel(patientName));
                  router.push("/archive");
                },
              )
            }
          />
          <InlineError>{remove.error}</InlineError>
        </div>
      )}
    </div>
  );
}

function Inner(p: ChartViewProps & { epoch: number }) {
  const latest = p.abgs.length ? p.abgs[p.abgs.length - 1] : null;
  return (
    <div className="grid gap-4">
      <StaleBanner />
      <header className={`flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 ${HUE[wardHue(p.wardId)].panel}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill hue={wardHue(p.wardId)}>{p.wardTitle} • {p.bedName}</Pill>
            {p.discharged && <Pill>Discharged</Pill>}
          </div>
          <h1 className="mt-1.5 break-words text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {patientLabel(p.overview.patientName, p.bedName)}
          </h1>
          <p className="mt-0.5 break-words text-xs sm:text-sm text-text-secondary">
            {ageText(p.overview.age) && `${ageText(p.overview.age)}. `}
            {isBlank(p.overview.diagnosis) ? <span className="text-text-muted">{NO_DIAGNOSIS}</span> : p.overview.diagnosis}
          </p>
        </div>
        <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2">
          <PrintPatientButton admissionId={p.admissionId} patientName={p.overview.patientName} variant="secondary" className={ACTION_BUTTON} title="Download the patient chart as a PDF">
            <FileText size={15} className="mr-1 inline" aria-hidden="true" />
            Print PDF
          </PrintPatientButton>
          {!p.discharged && (
            <>
              <TransferDialog patientName={p.overview.patientName} bedName={p.bedName} wardId={p.wardId} className={ACTION_BUTTON} />
              <DischargeDialog patientName={p.overview.patientName} bedName={p.bedName} className={ACTION_BUTTON} />
            </>
          )}
        </div>
      </header>

      {p.discharged && (
        <div className={`grid gap-3 rounded-2xl border p-4 ${outcomeHue(p.discharged.outcome) ? HUE[outcomeHue(p.discharged.outcome)!].panel : "border-border bg-surface-muted"}`}>
          <p>
            <span className="font-medium">Discharged {formatCairo(p.discharged.at)}</span> by {p.discharged.by}. Attending: {p.discharged.attending || "not recorded"}.
          </p>
          <p>
            <span className="font-medium">Outcome:</span> <Pill hue={outcomeHue(p.discharged.outcome)}>{p.discharged.outcome}</Pill>
          </p>
          {p.discharged.notes && <p className="whitespace-pre-wrap">{p.discharged.notes}</p>}
          <ArchiveActions patientName={p.overview.patientName} />
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList aria-label="Chart sections" className="overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="abg">Blood gases</TabsTrigger>
          <TabsTrigger value="insulin">Insulin</TabsTrigger>
          <TabsTrigger value="drugs">Drugs</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewSection key={`o${p.epoch}`} data={p.overview} hue={wardHue(p.wardId)} />
        </TabsContent>
        <TabsContent value="abg">
          <AbgSection rows={p.abgs} nowIso={p.nowIso} initialAcetone={p.overview.urineAcetone} currentRbg={p.overview.currentRbg} />
        </TabsContent>
        <TabsContent value="insulin">
          <InsulinSection key={`i${p.epoch}`} data={p.insulin} />
        </TabsContent>
        <TabsContent value="drugs">
          <DrugsSection meds={p.meds} />
        </TabsContent>
        <TabsContent value="plan">
          <PlanSection key={`pl${p.epoch}`} data={p.overview} media={p.media} hue={wardHue(p.wardId)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** The three header actions share the row equally on phones and size to their label from `sm`. */
const ACTION_BUTTON = "min-w-0 flex-1 cursor-pointer px-2! sm:flex-none sm:px-4!";

export function ChartView(props: ChartViewProps) {
  return (
    <ChartProvider
      admissionId={props.admissionId}
      serverVersion={props.serverVersion}
      role={props.role}
      readOnly={!!props.discharged}
      uploadMode={props.uploadMode}
      onDischarged={props.onDischarged}
    >
      {({ epoch }) => <Inner {...props} epoch={epoch} />}
    </ChartProvider>
  );
}
