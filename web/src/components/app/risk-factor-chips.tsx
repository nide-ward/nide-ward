"use client";

export const RISK_FACTORS_MAX = 1000;

export const RISK_FACTOR_TAGS = ["Uncontrolled", "Missed doses", "Common cold", "Recent T1DM", "Dysuria", "SGLT2i", "Lipodystrophy", "Stress", "Menses"] as const;

const splitTags = (text: string) => text.split(",").map((part) => part.trim().toLowerCase());

/** Appends `tag` to a comma-separated list unless it is already there (any letter case) or would pass the length limit. */
export function addRiskTag(text: string, tag: string): string {
  if (splitTags(text).includes(tag.toLowerCase())) return text;
  const base = text.trim().replace(/,+$/, "");
  const next = base === "" ? tag : `${base}, ${tag}`;
  return next.length > RISK_FACTORS_MAX ? text : next;
}

/** Tap-to-add chips for the risk factors textarea. Tags already in the text show as pressed. */
export function RiskFactorChips({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const present = splitTags(value);
  return (
    <div role="group" aria-label="Add a common risk factor" className="flex flex-wrap gap-2">
      {RISK_FACTOR_TAGS.map((tag) => {
        const added = present.includes(tag.toLowerCase());
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={added}
            onClick={() => onChange(addRiskTag(value, tag))}
            className={`min-h-11 touch-manipulation rounded-full border px-3.5 text-sm sm:min-h-9 sm:px-3 ${added ? "border-accent bg-accent-subtle text-foreground" : "border-border text-text-secondary hover:bg-surface-muted"}`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
