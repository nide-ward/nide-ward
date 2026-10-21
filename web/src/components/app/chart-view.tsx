"use client";

import Link from "next/link";
import Alert from "@/components/arc/alert/alert";
import Button from "@/components/arc/button/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { outcomeHue, wardHue, HUE } from "@/lib/hues";
import { NO_DIAGNOSIS, ageText, isBlank, patientLabel } from "@/lib/display";
import { readmitPatient } from "@/server/actions/patients";
import type { ClinicalRole } from "@/lib/permissions";
import { formatCairo } from "@/lib/time";
import { AbgDueBadge, AbgSection, type AbgRowData } from "./abg-section";
import { ChartProvider, useChart } from "./chart-context";
import { DischargeDialog } from "./discharge-dialog";
import { DrugsSection, type MedRow } from "./drugs-section";
import { InsulinSection, type InsulinData } from "./insulin-section";
import { MediaSection, type MediaRow } from "./media-section";
import { OverviewSection, type OverviewData } from "./overview-section";
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

function ReadmitButton() {
  const chart = useChart();
  const { toast } = useToast();
  const { run, pending, error } = useAction();
  if (!chart.readOnly || !(chart.role === "resident" || chart.role === "attending")) return null;
  return (
    <div className="grid gap-2">
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => void run(() => readmitPatient({ admissionId: chart.admissionId }), () => toast("Patient re-admitted to the original bed"))}
      >
        Re-admit to bed
      </Button>
      <InlineError>{error}</InlineError>
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
          <p className="text-sm text-text-secondary">
            <Link href="/" className="underline-offset-2 hover:underline">
              Ward board
            </Link>{" "}
            / {p.wardTitle} / {p.bedName}
          </p>
          <h1 className="mt-1 break-words text-2xl font-medium">{patientLabel(p.overview.patientName, p.bedName)}</h1>
          <p className="mt-1 text-text-secondary">
            {ageText(p.overview.age) && `${ageText(p.overview.age)}. `}
            {isBlank(p.overview.diagnosis) ? <span className="text-text-muted">{NO_DIAGNOSIS}</span> : p.overview.diagnosis}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.discharged ? <Pill>Discharged</Pill> : <AbgDueBadge lastTakenAt={latest ? latest.takenAt : null} nowIso={p.nowIso} />}
          <Link
            href={`/print/patient/${p.admissionId}`}
            target="_blank"
            className="hidden min-h-11 items-center rounded-xl border border-border-strong px-4 text-sm hover:bg-surface-muted sm:inline-flex"
          >
            Print chart
          </Link>
          {!p.discharged && <DischargeDialog patientName={p.overview.patientName} bedName={p.bedName} />}
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
          <ReadmitButton />
        </div>
      )}

      {!p.discharged && <ProtocolPills latestAbg={latest} urineAcetone={p.overview.urineAcetone} />}

      <Tabs defaultValue="overview">
        <TabsList aria-label="Chart sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="abg">Blood gases</TabsTrigger>
          <TabsTrigger value="insulin">Insulin</TabsTrigger>
          <TabsTrigger value="drugs">Drugs</TabsTrigger>
          <TabsTrigger value="photos">Lab photos</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewSection key={`o${p.epoch}`} data={p.overview} hue={wardHue(p.wardId)} />
        </TabsContent>
        <TabsContent value="abg">
          <AbgSection rows={p.abgs} nowIso={p.nowIso} />
        </TabsContent>
        <TabsContent value="insulin">
          <InsulinSection key={`i${p.epoch}`} data={p.insulin} />
        </TabsContent>
        <TabsContent value="drugs">
          <DrugsSection meds={p.meds} />
        </TabsContent>
        <TabsContent value="photos">
          <MediaSection media={p.media} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ChartView(props: ChartViewProps) {
  return (
    <ChartProvider
      admissionId={props.admissionId}
      serverVersion={props.serverVersion}
      role={props.role}
      readOnly={!!props.discharged}
      uploadMode={props.uploadMode}
    >
      {({ epoch }) => <Inner {...props} epoch={epoch} />}
    </ChartProvider>
  );
}
