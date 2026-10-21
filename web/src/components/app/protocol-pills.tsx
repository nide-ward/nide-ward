import { analyzeABG, fluidGuidance, insulinGuidance, type AbgEntry } from "@/lib/clinical";
import type { Hue } from "@/lib/hues";
import { Pill } from "./ui";

const INSULIN_HUE: Record<string, Hue | undefined> = { shift: "teal", halted: "rose", maintain: "amber", awaiting: undefined };

/** The fluid and insulin protocol guidance from updateProtocolGuidance, shown with a text label (never color alone). */
export function ProtocolPills({ latestAbg, urineAcetone }: { latestAbg: AbgEntry | null; urineAcetone: string }) {
  const fluid = fluidGuidance(urineAcetone, latestAbg);
  const insulin = insulinGuidance(analyzeABG(latestAbg));
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${fluid.state === "stop" ? "border-hue-emerald-line bg-hue-emerald-soft" : "border-hue-amber-line bg-hue-amber-soft"}`}>
        <Pill hue={fluid.state === "stop" ? "emerald" : "amber"} dot pulse={fluid.state !== "stop"}>
          {fluid.state === "stop" ? "Stop fluids" : "Continue fluids"}
        </Pill>
        <span className="min-w-0 text-sm">{fluid.text}</span>
      </div>
      <div
        className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
          insulin.state === "shift"
            ? "border-hue-teal-line bg-hue-teal-soft"
            : insulin.state === "halted"
              ? "border-hue-rose-line bg-hue-rose-soft"
              : insulin.state === "maintain"
                ? "border-hue-amber-line bg-hue-amber-soft"
                : "border-border bg-surface-muted"
        }`}
      >
        <Pill hue={INSULIN_HUE[insulin.state]} dot pulse={insulin.state === "halted"}>
          {insulin.state === "shift" ? "Shift ready" : insulin.state === "halted" ? "Shift halted" : insulin.state === "maintain" ? "IM insulin" : "No ABG"}
        </Pill>
        <span className="min-w-0 text-sm">{insulin.text}</span>
      </div>
    </div>
  );
}
