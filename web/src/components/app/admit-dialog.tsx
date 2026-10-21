"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { HUE, wardHue } from "@/lib/hues";
import { AdmitForm } from "./admit-form";
import { useToast } from "./toast-provider";
import { Pill } from "./ui";

export interface AdmitTarget {
  bedId: string;
  bedName: string;
  bedTypeLabel: string;
  wardId: string;
  wardTitle: string;
  /** Admission time pre-filled in the form (Cairo, datetime-local format), taken when the dialog opened. */
  openedAt: string;
}

/**
 * The admit flow as a dialog over the ward board (a full-height sheet on phones, see .admit-dialog in globals.css).
 * The form keeps its state while open; closing with anything entered asks first, so a stray tap outside the
 * dialog never throws away a half-filled admission.
 */
export function AdmitDialog({ target, onClose }: { target: AdmitTarget | null; onClose: () => void }) {
  const { toast } = useToast();
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  const finish = useCallback(() => {
    setConfirming(false);
    setDirty(false);
    onClose();
  }, [onClose]);

  // Escape, the close button and taps outside all arrive here.
  const requestClose = () => {
    if (confirming) setConfirming(false); // Escape on the question means "keep editing"
    else if (dirty) setConfirming(true);
    else finish();
  };

  const hue = HUE[wardHue(target?.wardId ?? "")];

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && requestClose()}>
      {target && (
        <DialogContent
          className="admit-dialog"
          title={`Admit to ${target.bedName}`}
          description="Everything is optional. Admit now and complete the chart later, or fill it in as you go."
          onOpenAutoFocus={(e) => {
            // Phones: do not pop the keyboard open over the sheet. Desktops: start in the name field.
            if (window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              document.getElementById("admit-name")?.focus();
            }
          }}
        >
          <div className="grid gap-4">
            <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${hue.panel}`}>
              <span aria-hidden="true" className={`size-2.5 rounded-full ${hue.dot}`} />
              <span className={`font-medium ${hue.ink}`}>{target.wardTitle}</span>
              <Pill hue={wardHue(target.wardId)}>{target.bedTypeLabel} bed</Pill>
              <Pill hue="emerald" dot>Empty bed</Pill>
            </div>

            {confirming && (
              <div role="alert" className="grid gap-3 rounded-xl border border-warning bg-surface p-4">
                <p className="font-medium">Discard this admission?</p>
                <p className="text-text-secondary">What you entered has not been saved and will be lost.</p>
                <div className="flex flex-wrap gap-2">
                  <Button ref={keepRef} onClick={() => setConfirming(false)}>
                    Keep editing
                  </Button>
                  <Button variant="secondary" onClick={finish}>
                    Discard
                  </Button>
                </div>
              </div>
            )}

            <AdmitForm
              bedId={target.bedId}
              initialTime={target.openedAt}
              inDialog
              onDirtyChange={setDirty}
              onCancel={requestClose}
              onDone={() => {
                toast(`Patient admitted to ${target.bedName}`);
                finish();
              }}
            />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

/** The same form on its own page, for direct links to /beds/<id>/admit. Done and Cancel both return to the board. */
export function AdmitPageForm({ bedId, bedName, initialTime }: { bedId: string; bedName: string; initialTime: string }) {
  const router = useRouter();
  const { toast } = useToast();
  return (
    <AdmitForm
      bedId={bedId}
      initialTime={initialTime}
      onCancel={() => router.push("/")}
      onDone={() => {
        toast(`Patient admitted to ${bedName}`);
        router.replace("/");
      }}
    />
  );
}
