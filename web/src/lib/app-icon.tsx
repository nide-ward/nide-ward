import { ImageResponse } from "next/og";

/** Teal from the prototype's accent (Tailwind teal-700). Shared by every generated app icon. */
export const ICON_BACKGROUND = "#0f766e";

/**
 * The home-screen icon as a PNG: a full-bleed teal square with "NW". Full bleed so it also works
 * as a maskable icon (Android crops it to a circle or squircle; the letters sit in the safe zone).
 */
export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ICON_BACKGROUND,
          color: "#ffffff",
          fontSize: size * 0.36,
          fontWeight: 700,
          letterSpacing: -size * 0.01,
        }}
      >
        NW
      </div>
    ),
    { width: size, height: size },
  );
}
