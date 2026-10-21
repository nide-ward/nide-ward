"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, BedDouble, Building2, CalendarClock, LogOut, Users } from "lucide-react";
import Button from "@/components/arc/button/button";
import { authClient } from "@/lib/auth-client";
import { can, ROLE_INFO, type ClinicalRole } from "@/lib/permissions";
import type { Theme } from "@/lib/theme";
import { ROLE_HUE } from "@/lib/hues";
import { Pill } from "./ui";
import { CairoClock } from "./cairo-clock";
import { ThemePicker } from "./theme-picker";

interface Props {
  name: string;
  role: ClinicalRole;
  theme: Theme;
  roster: { doc1: string; doc2: string | null; attending: string } | null;
}

/**
 * Phones (the main device on the ward): a compact top bar and a tab bar fixed to the bottom,
 * within thumb reach. From the `sm` breakpoint up: the full header with the nav under it.
 */
export function AppHeader({ name, role, roster, theme }: Props) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Ward board", short: "Board", icon: BedDouble, show: true },
    { href: "/archive", label: "Archive", short: "Archive", icon: Archive, show: true },
    { href: "/roster", label: "Shift roster", short: "Roster", icon: CalendarClock, show: true },
    { href: "/staff", label: "Staff", short: "Staff", icon: Users, show: can(role, "staff.manage") },
  ].filter((l) => l.show);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const rosterText = roster
    ? `Duty: ${roster.doc1}${roster.doc2 ? ` and ${roster.doc2}` : ""}. Attending: ${roster.attending}`
    : "No shift roster set yet";

  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    // Do not pass the click event into authClient.signOut — Better Auth treats the
    // first argument as the request body and JSON-serializing a SyntheticEvent throws.
    try {
      await authClient.signOut();
    } catch {
      // Fall through: still leave the page; the server will reject a dead session.
    }
    // Full page load so cookies and cached server components are reset on phone and desktop.
    // The spinner stays on until the browser leaves this page.
    window.location.assign("/login");
  }

  return (
    <>
      <header className="no-print">
        {/* Dark slate bar with the teal accent, as in the prototype. */}
        <div className="bg-topbar pt-[env(safe-area-inset-top)] text-topbar-ink">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <p className="flex min-w-0 items-center gap-2 text-sm">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-topbar-accent" />
              <span className="truncate font-medium text-topbar-strong">
                <span className="sm:hidden">NIDE ward tracker</span>
                <span className="hidden sm:inline">National Institute for Diabetes and Endocrinology (NIDE)</span>
              </span>
              <span className="hidden text-topbar-ink lg:inline">Inpatient ward and DKA unit</span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <CairoClock className="hidden text-sm text-topbar-ink sm:inline" />
              <ThemePicker initial={theme} />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={signingOut}
                onClick={() => void signOut()}
                className="hidden cursor-pointer sm:inline-flex"
              >
                Sign out
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={signingOut}
                onClick={() => void signOut()}
                className="cursor-pointer touch-manipulation sm:hidden"
                aria-label="Sign out"
              >
                <LogOut size={18} aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
        <div className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:flex-wrap sm:px-6 sm:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span aria-hidden="true" className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground sm:inline-flex">
                <Building2 size={20} />
              </span>
              <div className="min-w-0">
                <p className="hidden text-lg font-medium sm:block">Ward patient tracker</p>
                {/* Phone: who is signed in, then the roster on one line. */}
                <p className="truncate text-sm text-text-secondary sm:hidden">
                  {name}, {ROLE_INFO[role].title.toLowerCase()}
                </p>
                <p className="truncate text-sm text-text-secondary">{rosterText}</p>
              </div>
            </div>
            <div className="hidden flex-wrap items-center gap-3 sm:flex">
              <Pill hue={ROLE_HUE[role]}>{ROLE_INFO[role].title}</Pill>
              <span className="text-sm font-medium">{name}</span>
            </div>
          </div>
          <nav aria-label="Main" className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-6 pb-2 sm:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-4 text-sm ${
                  isActive(l.href) ? "bg-accent-subtle font-medium text-accent-strong" : "text-text-secondary hover:bg-surface-muted"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav aria-label="Main" className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface sm:hidden">
        <ul className="flex">
          {links.map((l) => {
            const Icon = l.icon;
            const active = isActive(l.href);
            return (
              <li key={l.href} className="flex-1">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                    active ? "font-medium text-accent-strong" : "text-text-secondary"
                  }`}
                >
                  <Icon size={22} aria-hidden="true" strokeWidth={active ? 2.25 : 1.75} />
                  {l.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
