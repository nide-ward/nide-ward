"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, BedDouble, Building2, CalendarClock, Loader2, LogOut, Users } from "lucide-react";
import Button from "@/components/arc/button/button";
import { authClient } from "@/lib/auth-client";
import { can, ROLE_INFO, type ClinicalRole } from "@/lib/permissions";
import type { Theme } from "@/lib/theme";
import { ROLE_HUE } from "@/lib/hues";
import { Pill } from "./ui";
import { CairoClock } from "./cairo-clock";
import { ThemePicker } from "./theme-picker";
import { SyncStatusPill } from "./sync-status-pill";

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
  const dutyDoctors = [roster?.doc1, roster?.doc2].filter(Boolean);
  const dutyText = dutyDoctors.length > 0 ? `Duty: ${dutyDoctors.join(" and ")}` : "";
  const attendingText = roster?.attending ? `Attending: ${roster.attending}` : "";
  const rosterText =
    dutyText && attendingText
      ? `${dutyText}. ${attendingText}`
      : dutyText || attendingText || "No shift roster set yet";

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
      <header className="no-print w-full overflow-x-clip">
        {/* Dark slate bar with the teal accent, as in the prototype. */}
        <div className="w-full bg-topbar pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-topbar-ink">
          <div className="mx-auto flex h-14 w-full max-w-7xl flex-nowrap items-center justify-between gap-2 px-3 sm:h-12 sm:gap-3 sm:px-6">
            <p className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-topbar-accent" />
              <span className="truncate font-medium text-topbar-strong">
                <span className="sm:hidden">NIDE ward tracker</span>
                <span className="hidden sm:inline">National Institute for Diabetes and Endocrinology (NIDE)</span>
              </span>
              <span className="hidden shrink-0 text-topbar-ink xl:inline">Inpatient ward and DKA unit</span>
            </p>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <CairoClock className="hidden text-sm text-topbar-ink sm:inline" />
              <SyncStatusPill />
              <ThemePicker initial={theme} />
              <span className="hidden sm:inline-flex">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={signingOut}
                  onClick={() => void signOut()}
                  className="cursor-pointer"
                >
                  Sign out
                </Button>
              </span>
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void signOut()}
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex size-11 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-xl border border-topbar-border bg-topbar-control text-topbar-ink transition hover:text-topbar-strong disabled:opacity-60 sm:hidden"
              >
                {signingOut ? (
                  <Loader2 size={18} aria-hidden="true" className="animate-spin" />
                ) : (
                  <LogOut size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="w-full border-b border-border bg-surface pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <div className="mx-auto flex h-14 w-full max-w-7xl flex-nowrap items-center justify-between gap-3 px-3 sm:h-auto sm:gap-6 sm:px-6 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span aria-hidden="true" className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground sm:inline-flex">
                <Building2 size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="hidden truncate text-lg font-medium sm:block">Ward patient tracker</p>
                {/* Phone: who is signed in, then the roster on one line. */}
                <p className="truncate text-sm leading-5 text-text-secondary sm:hidden">
                  {name}, {ROLE_INFO[role].title.toLowerCase()}
                </p>
                <p className="truncate text-sm leading-5 text-text-secondary">{rosterText}</p>
              </div>
            </div>
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <Pill hue={ROLE_HUE[role]}>{ROLE_INFO[role].title}</Pill>
              <span className="max-w-[14rem] truncate text-sm font-medium">{name}</span>
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

      <nav
        aria-label="Main"
        className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 w-full border-t border-border bg-surface pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] sm:hidden"
      >
        <ul className="flex w-full items-center justify-around">
          {links.map((l) => {
            const Icon = l.icon;
            const active = isActive(l.href);
            return (
              <li key={l.href} className="min-w-0 flex-1">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-14 touch-manipulation flex-col items-center justify-center gap-0.5 px-1 text-xs ${
                    active ? "font-medium text-accent-strong" : "text-text-secondary"
                  }`}
                >
                  <Icon size={22} aria-hidden="true" strokeWidth={active ? 2.25 : 1.75} />
                  <span className="max-w-full truncate">{l.short}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
