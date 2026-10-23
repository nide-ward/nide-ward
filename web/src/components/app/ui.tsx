import type { ReactNode } from "react";
import { HUE, type Hue } from "@/lib/hues";

/** A bordered surface. Cards rest on a 1px border, no shadow. */
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  hue,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Tints the panel in one of the prototype's section colours. */
  hue?: Hue;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${hue ? HUE[hue].panel : "border-border bg-surface"} ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className={`text-base font-medium ${hue ? HUE[hue].ink : ""}`}>{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function Definition({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-text-secondary">{label}</dt>
      <dd className="mt-0.5 break-words">{children || <span className="text-text-muted">None</span>}</dd>
    </div>
  );
}

export function fmtNum(v: number | null | undefined): string {
  return v === null || v === undefined ? "--" : String(v);
}

/** Small status label in a prototype colour. `pulse` draws attention (an overdue blood gas). */
export function Pill({ hue, dot, pulse, children, className = "" }: { hue?: Hue; dot?: boolean; pulse?: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs font-medium break-words ${hue ? HUE[hue].pill : "border-border bg-surface-muted text-text-secondary"} ${className}`}
    >
      {dot && <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${hue ? HUE[hue].dot : "bg-text-muted"} ${pulse ? "motion-safe:animate-pulse" : ""}`} />}
      {children}
    </span>
  );
}
