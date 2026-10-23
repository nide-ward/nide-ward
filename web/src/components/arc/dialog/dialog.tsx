"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./dialog.module.css";

/** Mirrors the open state so the content can stay mounted while it animates out, and retarget mid-flight if it is reopened or closed early. */
const OpenContext = createContext<boolean | null>(null);

export function Dialog({ open: openProp, defaultOpen = false, onOpenChange, ...props }: ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const setOpen = useCallback((next: boolean) => { if (openProp === undefined) setUncontrolled(next); onOpenChange?.(next); }, [openProp, onOpenChange]);
  return <OpenContext.Provider value={open}><DialogPrimitive.Root {...props} open={open} onOpenChange={setOpen}/></OpenContext.Provider>;
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  title: string;
  description?: string;
  children: ReactNode;
}

const fade: Transition = { duration: motionTokens.duration.instant };
const leave: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };

function subscribeSheetQuery(cb: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function getSheetSnapshot() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches;
}
function getServerSheetSnapshot() {
  return false;
}

/**
 * On phones the software keyboard shrinks visualViewport without resizing the layout viewport.
 * Fitting the sheet to visualViewport keeps scrollable fields and bottom action bars above the keyboard.
 */
function useKeyboardFit(active: boolean) {
  const [fit, setFit] = useState<CSSProperties | undefined>();
  useEffect(() => {
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !viewport) return;
    const update = () => {
      const covered = window.innerHeight - viewport.height;
      setFit(
        covered > 120
          ? ({
              "--dialog-vv-top": `${viewport.offsetTop}px`,
              "--dialog-vv-bottom": `${Math.max(0, covered - viewport.offsetTop)}px`,
              "--dialog-vv-height": `${viewport.height}px`,
              "--dialog-safe-bottom": "0px",
            } as CSSProperties)
          : undefined,
      );
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      setFit(undefined);
    };
  }, [active]);
  return active ? fit : undefined;
}

/** When the title or description changes while open, the new copy rises in and the old copy leaves upward. */
function SwapText({ text }: { text: string }) {
  const reduced = useReducedMotion();
  return <AnimatePresence mode="popLayout" initial={false}>
    <motion.span key={text} className={styles.swap} initial={reduced ? false : { opacity: 0, y: "0.3em", filter: `blur(${motionTokens.blur.soft}px)` }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.3em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }} transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}>{text}</motion.span>
  </AnimatePresence>;
}

export function DialogContent({ title, description, children, className, style, onPointerDownOutside, ...props }: DialogContentProps) {
  const open = useContext(OpenContext);
  const reduced = useReducedMotion();
  const isSheet = useSyncExternalStore(subscribeSheetQuery, getSheetSnapshot, getServerSheetSnapshot);
  const keyboardFit = useKeyboardFit(open !== false);
  const mergedStyle = keyboardFit ? { ...keyboardFit, ...style } : style;
  // When the open state last changed. Radix waits for the click before treating a press as outside, and a press on the trigger
  // while the dialog leaves reopens it first, so that press must not close it again.
  const change = useRef({ open, at: 0 });
  useLayoutEffect(() => { change.current = { open, at: performance.now() }; }, [open]);
  const pressOutside: DialogContentProps["onPointerDownOutside"] = event => {
    onPointerDownOutside?.(event);
    if (open !== null && (!change.current.open || event.detail.originalEvent.timeStamp < change.current.at)) event.preventDefault();
  };
  const classes = [styles.content, className].filter(Boolean).join(" ");
  const inner = <>
    <div className={styles.header}><div><DialogPrimitive.Title className={styles.title}><SwapText text={title}/></DialogPrimitive.Title>{description ? <DialogPrimitive.Description className={styles.description}><SwapText text={description}/></DialogPrimitive.Description> : null}</div><DialogPrimitive.Close className={styles.close} aria-label="Close dialog"><X size={16} strokeWidth={1.75} aria-hidden="true"/></DialogPrimitive.Close></div>
    <div className={styles.body}>{children}</div>
  </>;
  // Under a bare Radix root the open state is unknown here, so CSS keyframes keyed off data-state animate the layers instead.
  if (open === null) return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className={`${styles.overlay} ${styles.keyframes}`}/>
    <DialogPrimitive.Content {...props} style={mergedStyle} onPointerDownOutside={pressOutside} className={`${classes} ${styles.keyframes}`}>{inner}</DialogPrimitive.Content>
  </DialogPrimitive.Portal>;
  // Phone sheets slide without scaling so full-bleed edges stay flush and inputs never render below 16px mid-spring.
  const enterFrom = reduced ? { opacity: 0 } : isSheet ? { opacity: 0, y: 20 } : { opacity: 0, y: 8, scale: .96 };
  const exitTo = reduced ? { opacity: 0, transition: fade } : isSheet ? { opacity: 0, y: 12, transition: leave } : { opacity: 0, y: 4, scale: .98, transition: leave };
  return <AnimatePresence>
    {open && <DialogPrimitive.Portal key="dialog" forceMount>
      <DialogPrimitive.Overlay forceMount asChild><motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: reduced ? fade : leave }} transition={reduced ? fade : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}></motion.div></DialogPrimitive.Overlay>
      <DialogPrimitive.Content {...props} style={mergedStyle} onPointerDownOutside={pressOutside} forceMount asChild><motion.div className={classes} initial={enterFrom} animate={{ opacity: 1, y: 0, scale: 1 }} exit={exitTo} transition={reduced ? fade : { default: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] } }}>{inner}</motion.div></DialogPrimitive.Content>
    </DialogPrimitive.Portal>}
  </AnimatePresence>;
}
