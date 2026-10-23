"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, LoaderCircle } from "lucide-react";
import Button from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { parseABGSlipTexts } from "@/lib/clinical";
import { normalizeNumericText } from "@/lib/numeric-input";
import { OcrError, preloadOcr, prepareImage, readSlipText, type OcrProgress } from "@/lib/ocr/slip-ocr";
import { EMPTY, FIELDS, slipToFields, type FieldKey } from "./abg-fields";
import { HUE } from "@/lib/hues";

type Phase = "idle" | "working" | "review";

interface Props {
  /** Receives only the values the user kept; blank fields are left out so they do not overwrite the form. */
  onApply: (values: Partial<Record<FieldKey, string>>) => void;
  /** Called when the scan cannot give usable values, so the caller can open its paste-text box. */
  onFallback: () => void;
  /** Called with the raw text the reader saw, so it can be shown in the paste-text box for correction. */
  onText?: (text: string) => void;
  /** Rendered beside the scan button, e.g. the "Paste slip text" toggle. */
  children?: React.ReactNode;
}

/**
 * Scan the analyser slip with the phone camera (or an existing photo), read it on the device with OCR,
 * check the values, then fill the blood gas form. Same flow as the prototype's scanner:
 * photo, progress, editable review grid, "use these values". The photo is never uploaded or saved.
 */
export function SlipScanner({ onApply, onFallback, onText, children }: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<OcrProgress>({ label: "Preparing the photo", fraction: null });
  const [preview, setPreview] = useState<string | null>(null);
  const [values, setValues] = useState<Record<FieldKey, string>>(EMPTY);
  const [message, setMessage] = useState<string | null>(null);
  const run = useRef(0);

  // Release the preview object URL when it is replaced or the component goes away.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );

  const toggle = () => {
    setOpen((o) => {
      if (!o) preloadOcr();
      return !o;
    });
  };

  async function scan(file: File) {
    const id = ++run.current;
    setPreview(URL.createObjectURL(file));
    setPhase("working");
    setMessage(null);
    setProgress({ label: "Preparing the photo", fraction: null });
    try {
      const canvas = await prepareImage(file);
      const texts = await readSlipText(canvas, (p) => {
        if (run.current === id) setProgress(p);
      });
      if (run.current !== id) return;
      onText?.(texts[0]);
      const found = slipToFields(parseABGSlipTexts(texts));
      const count = Object.keys(found).length;
      if (count === 0) {
        setPhase("idle");
        setMessage("No blood gas values were recognised. Retake the photo close up and flat, in good light, or paste the slip text below.");
        onFallback();
        return;
      }
      setValues({ ...EMPTY, ...found });
      setPhase("review");
    } catch (err) {
      if (run.current !== id) return;
      setPhase("idle");
      setMessage(
        err instanceof OcrError && err.kind === "image"
          ? "That photo could not be opened. Try another photo, or paste the slip text below."
          : "The slip reader could not start. It may be blocked on this network. Paste the slip text below, or type the values.",
      );
      onFallback();
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void scan(file);
  };

  const filled = FIELDS.filter((f) => values[f.key].trim() !== "").length;
  const reset = () => {
    run.current++;
    setPhase("idle");
    setPreview(null);
    setValues(EMPTY);
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={toggle} aria-expanded={open}>
          <Camera size={16} aria-hidden="true" /> Scan slip with camera
        </Button>
        {children}
      </div>
      {open && (
        <div className={`grid gap-3 rounded-2xl border p-3 sm:p-4 ${HUE.sky.panel}`}>
          <p className={`text-sm ${HUE.sky.ink}`}>
            Photograph the analyser slip. It is read on this device and the photo is not uploaded or saved.
          </p>

          {phase !== "working" && phase !== "review" && (
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
                <Camera size={18} aria-hidden="true" />
                Take a photo
                {/* capture opens the rear camera on phones; desktops show a file picker. */}
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} />
              </label>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
                <ImageIcon size={18} aria-hidden="true" />
                Choose a photo
                <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
              </label>
            </div>
          )}

          {preview && phase !== "idle" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Photo of the analyser slip being read" className="max-h-48 w-auto rounded-xl border border-border object-contain" />
          )}

          {phase === "working" && (
            <div role="status" className="grid gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 font-medium">
                <LoaderCircle size={16} className="shrink-0 motion-safe:animate-spin" aria-hidden="true" />
                {progress.label}
                {progress.fraction !== null && <span className="tnum text-text-secondary">{Math.round(progress.fraction * 100)}%</span>}
              </span>
              {progress.fraction !== null && (
                <progress className="h-1.5 w-full accent-[var(--accent)]" value={progress.fraction} max={1} aria-label="Reading progress" />
              )}
              <span className="text-text-secondary">This can take several seconds on a phone.</span>
              <div>
                <Button type="button" variant="ghost" size="sm" onClick={reset}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {message && phase === "idle" && (
            <p role="alert" className="rounded-xl border border-warning bg-surface px-3 py-2 text-sm">
              {message}
            </p>
          )}

          {phase === "review" && (
            <div className="grid gap-3">
              <p role="status" className="text-sm font-medium">
                {filled} value{filled === 1 ? "" : "s"} detected. Check each against the slip and correct any mistakes.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {FIELDS.map((f) => (
                  <Input
                    key={f.key}
                    label={f.label}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="--"
                    value={values[f.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: normalizeNumericText(e.target.value) }))}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    const keep: Partial<Record<FieldKey, string>> = {};
                    for (const f of FIELDS) if (values[f.key].trim() !== "") keep[f.key] = values[f.key].trim();
                    onApply(keep);
                    setOpen(false);
                    reset();
                  }}
                  disabled={filled === 0}
                >
                  Use these values
                </Button>
                <Button type="button" variant="secondary" onClick={reset}>
                  Scan again
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
