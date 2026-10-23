/**
 * Class maps for the prototype's colour roles. Tailwind only emits classes it can see as whole strings,
 * so every combination is spelled out here. The colours behind them are tokens in globals.css.
 */
export type Hue = "rose" | "pink" | "blue" | "indigo" | "amber" | "sky" | "purple" | "cyan" | "teal" | "emerald";

interface HueClasses {
  /** Tinted panel with its border. */
  panel: string;
  /** Heading or label text on a tinted panel. */
  ink: string;
  /** Small solid dot. */
  dot: string;
  /** Pill: tinted fill, border and ink. */
  pill: string;
  /** Solid fill for an active tab or primary mark. */
  solid: string;
  /** Occupied bed card: ward-coloured top strip, neutral border. */
  card: string;
  /** Tinted header band inside a card. */
  band: string;
  /** Coloured left edge for list rows and cards. */
  edge: string;
  /** Border on hover for a neutral card. */
  hover: string;
}

export const HUE: Record<Hue, HueClasses> = {
  rose: { band: "bg-hue-rose-soft", edge: "border-l-4 border-l-hue-rose", hover: "hover:border-hue-rose", panel: "border-hue-rose-line bg-hue-rose-soft", ink: "text-hue-rose-ink", dot: "bg-hue-rose", pill: "border-hue-rose-line bg-hue-rose-soft text-hue-rose-ink", solid: "border-hue-rose bg-hue-rose text-hue-on", card: "border-border border-t-4 border-t-hue-rose bg-surface hover:border-hue-rose" },
  pink: { band: "bg-hue-pink-soft", edge: "border-l-4 border-l-hue-pink", hover: "hover:border-hue-pink", panel: "border-hue-pink-line bg-hue-pink-soft", ink: "text-hue-pink-ink", dot: "bg-hue-pink", pill: "border-hue-pink-line bg-hue-pink-soft text-hue-pink-ink", solid: "border-hue-pink bg-hue-pink text-hue-on", card: "border-border border-t-4 border-t-hue-pink bg-surface hover:border-hue-pink" },
  blue: { band: "bg-hue-blue-soft", edge: "border-l-4 border-l-hue-blue", hover: "hover:border-hue-blue", panel: "border-hue-blue-line bg-hue-blue-soft", ink: "text-hue-blue-ink", dot: "bg-hue-blue", pill: "border-hue-blue-line bg-hue-blue-soft text-hue-blue-ink", solid: "border-hue-blue bg-hue-blue text-hue-on", card: "border-border border-t-4 border-t-hue-blue bg-surface hover:border-hue-blue" },
  indigo: { band: "bg-hue-indigo-soft", edge: "border-l-4 border-l-hue-indigo", hover: "hover:border-hue-indigo", panel: "border-hue-indigo-line bg-hue-indigo-soft", ink: "text-hue-indigo-ink", dot: "bg-hue-indigo", pill: "border-hue-indigo-line bg-hue-indigo-soft text-hue-indigo-ink", solid: "border-hue-indigo bg-hue-indigo text-hue-on", card: "border-border border-t-4 border-t-hue-indigo bg-surface hover:border-hue-indigo" },
  amber: { band: "bg-hue-amber-soft", edge: "border-l-4 border-l-hue-amber", hover: "hover:border-hue-amber", panel: "border-hue-amber-line bg-hue-amber-soft", ink: "text-hue-amber-ink", dot: "bg-hue-amber", pill: "border-hue-amber-line bg-hue-amber-soft text-hue-amber-ink", solid: "border-hue-amber bg-hue-amber text-hue-on", card: "border-border border-t-4 border-t-hue-amber bg-surface hover:border-hue-amber" },
  sky: { band: "bg-hue-sky-soft", edge: "border-l-4 border-l-hue-sky", hover: "hover:border-hue-sky", panel: "border-hue-sky-line bg-hue-sky-soft", ink: "text-hue-sky-ink", dot: "bg-hue-sky", pill: "border-hue-sky-line bg-hue-sky-soft text-hue-sky-ink", solid: "border-hue-sky bg-hue-sky text-hue-on", card: "border-border border-t-4 border-t-hue-sky bg-surface hover:border-hue-sky" },
  purple: { band: "bg-hue-purple-soft", edge: "border-l-4 border-l-hue-purple", hover: "hover:border-hue-purple", panel: "border-hue-purple-line bg-hue-purple-soft", ink: "text-hue-purple-ink", dot: "bg-hue-purple", pill: "border-hue-purple-line bg-hue-purple-soft text-hue-purple-ink", solid: "border-hue-purple bg-hue-purple text-hue-on", card: "border-border border-t-4 border-t-hue-purple bg-surface hover:border-hue-purple" },
  cyan: { band: "bg-hue-cyan-soft", edge: "border-l-4 border-l-hue-cyan", hover: "hover:border-hue-cyan", panel: "border-hue-cyan-line bg-hue-cyan-soft", ink: "text-hue-cyan-ink", dot: "bg-hue-cyan", pill: "border-hue-cyan-line bg-hue-cyan-soft text-hue-cyan-ink", solid: "border-hue-cyan bg-hue-cyan text-hue-on", card: "border-border border-t-4 border-t-hue-cyan bg-surface hover:border-hue-cyan" },
  teal: { band: "bg-hue-teal-soft", edge: "border-l-4 border-l-hue-teal", hover: "hover:border-hue-teal", panel: "border-hue-teal-line bg-hue-teal-soft", ink: "text-hue-teal-ink", dot: "bg-hue-teal", pill: "border-hue-teal-line bg-hue-teal-soft text-hue-teal-ink", solid: "border-hue-teal bg-hue-teal text-hue-on", card: "border-border border-t-4 border-t-hue-teal bg-surface hover:border-hue-teal" },
  emerald: { band: "bg-hue-emerald-soft", edge: "border-l-4 border-l-hue-emerald", hover: "hover:border-hue-emerald", panel: "border-hue-emerald-line bg-hue-emerald-soft", ink: "text-hue-emerald-ink", dot: "bg-hue-emerald", pill: "border-hue-emerald-line bg-hue-emerald-soft text-hue-emerald-ink", solid: "border-hue-emerald bg-hue-emerald text-hue-on", card: "border-border border-t-4 border-t-hue-emerald bg-surface hover:border-hue-emerald" },
};

/** Ward colours from the prototype's WARD_STRUCTURE themes. */
export const WARD_HUE: Record<string, Hue> = { female: "pink", male: "blue", paid: "indigo", overflow: "amber" };
export const wardHue = (wardId: string): Hue => WARD_HUE[wardId] ?? "teal";

/**
 * One colour, one meaning, everywhere. Each badge also carries a text label, never colour alone.
 *   bed type   standard neutral, extra amber, private indigo, surge rose
 *   abg        due or overdue rose (pulsing dot), on time emerald
 *   protocol   shift ready teal, shift halted rose, IM insulin amber, no ABG neutral; stop fluids emerald, continue fluids amber
 *   insulin    Lantus purple, Actrapid amber
 *   lab photos cyan
 *   roles      admin purple, attending teal, resident sky
 *   staff      active emerald, deactivated neutral
 *   discharge  discharged neutral (slate); outcome home emerald, general ward sky, ICU rose, DAMA amber, outside facility indigo
 *   acetone    negative emerald, trace sky, + amber, ++ amber, +++ and ++++ rose
 */
export const BED_TYPE_HUE: Record<"regular" | "extra" | "paid" | "overflow", Hue | undefined> = { regular: undefined, extra: "amber", paid: "indigo", overflow: "rose" };
export const ROLE_HUE: Record<"admin" | "attending" | "resident", Hue> = { admin: "purple", attending: "teal", resident: "sky" };
export const ACETONE_HUE: Record<string, Hue> = { Negative: "emerald", Trace: "sky", "+": "amber", "++": "amber", "+++": "rose", "++++": "rose" };

/** Matches the DISCHARGE_OUTCOMES wording in validation.ts; anything else (older records) stays neutral. */
export function outcomeHue(outcome: string): Hue | undefined {
  if (/^DKA Resolved/i.test(outcome)) return "emerald";
  if (/General Ward/i.test(outcome)) return "sky";
  if (/ICU|Critical/i.test(outcome)) return "rose";
  if (/DAMA|Medical Advice/i.test(outcome)) return "amber";
  if (/Outside Facility/i.test(outcome)) return "indigo";
  return undefined;
}
