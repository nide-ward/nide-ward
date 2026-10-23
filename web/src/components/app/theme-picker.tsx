"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { setTheme } from "@/server/actions/preferences";
import type { Theme } from "@/lib/theme";
import { useToast } from "./toast-provider";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** Applies a theme to the page straight away; the saved preference then renders it server-side. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme-pref", theme);
  const dark = theme === "dark";
  root.setAttribute("data-theme", dark ? "dark" : "light");
}

/** Light, Dark or System. Saved on the user's profile, so it follows them to other devices. */
export function ThemePicker({ initial, className = "" }: { initial: Theme; className?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState<Theme>(initial);
  const [, startTransition] = useTransition();

  function choose(next: Theme) {
    if (next === value) return;
    const previous = value;
    setValue(next);
    applyTheme(next);
    startTransition(async () => {
      const res = await setTheme({ theme: next }).catch(() => null);
      if (res?.ok) {
        router.refresh();
      } else {
        // Not saved: put the old theme back rather than showing one that will not stick.
        setValue(previous);
        applyTheme(previous);
        toast("Could not save the theme", res && !res.ok ? res.error : "Check the connection and try again.");
      }
    });
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" className={`inline-flex rounded-xl border border-topbar-border bg-topbar-control p-0.5 ${className}`}>
      {OPTIONS.map(({ value: v, label, icon: Icon }) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => choose(v)}
            className={`inline-flex size-10 items-center justify-center rounded-[10px] sm:size-8 ${
              on ? "bg-topbar-accent text-topbar" : "text-topbar-ink hover:text-topbar-strong"
            }`}
          >
            <Icon size={18} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
