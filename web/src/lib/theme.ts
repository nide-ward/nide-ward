/** Per-user colour theme. Light is the default; System follows the device. Stored on staff_profile.theme. */
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "light";

export function parseTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : DEFAULT_THEME;
}

/** Status bar / browser chrome colours: the top bar's slate in each theme (see --topbar in globals.css). */
export const THEME_COLOR = { light: "#0f172a", dark: "#020617" } as const;
