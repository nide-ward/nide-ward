import type { MetadataRoute } from "next";
import { ICON_BACKGROUND } from "@/lib/app-icon";

/** Lets staff add the tracker to their phone's home screen and open it full screen, without browser bars. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NIDE ward tracker",
    short_name: "Ward tracker",
    description: "Inpatient ward patient tracker for the National Institute for Diabetes and Endocrinology, Cairo.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#191919",
    theme_color: ICON_BACKGROUND,
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
