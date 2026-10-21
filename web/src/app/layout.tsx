import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "@/components/arc/foundation.css";
import "./globals.css";
import { ToastProvider } from "@/components/app/toast-provider";
import { getStaff } from "@/lib/session";
import { DEFAULT_THEME, THEME_COLOR, type Theme } from "@/lib/theme";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Ward tracker", template: "%s | NIDE ward tracker" },
  description: "Inpatient ward patient tracker for the National Institute for Diabetes and Endocrinology, Cairo.",
  robots: { index: false, follow: false },
  // Opened from the iOS home screen: full screen, with the app's own name under the icon.
  appleWebApp: { capable: true, title: "Ward tracker", statusBarStyle: "default" },
};

/** The signed-in user's saved theme. Signed-out pages (login), or any failure, use the light default. */
async function currentTheme(): Promise<Theme> {
  try {
    return (await getStaff())?.theme ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();
  return {
    width: "device-width",
    initialScale: 1,
    // Lets the layout reach under the notch and home indicator; the tab bar pads itself with safe-area insets.
    viewportFit: "cover",
    // The status bar matches the slate top bar. System follows the device scheme.
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
            { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
          ]
        : THEME_COLOR[theme],
  };
}

/**
 * Runs before first paint. The server already renders data-theme for light and dark; only "system"
 * needs the device scheme, and it keeps following it while the page is open.
 */
const themeScript = `(function(){try{var d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');var s=function(){if(d.getAttribute('data-theme-pref')==='system')d.setAttribute('data-theme',m.matches?'dark':'light')};s();m.addEventListener('change',s)}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await currentTheme();
  return (
    <html
      lang="en"
      className={`${geist.variable} ${inter.variable} ${mono.variable}`}
      data-accent="teal"
      data-theme={theme === "dark" ? "dark" : "light"}
      data-theme-pref={theme}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
