"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import Button from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import EmptyState from "@/components/arc/empty-state/empty-state";
import FileDropzone, { type FileDropzoneItem } from "@/components/arc/file-dropzone/file-dropzone";
import { deleteMedia, registerMedia } from "@/server/actions/media";
import { sniffImageType, undecodablePhotoMessage } from "@/app/api/uploads/image-rules";
import { uploadPhoto } from "@/lib/upload-client";
import { formatCairo } from "@/lib/time";
import { useChart } from "./chart-context";
import { useAction } from "./use-action";
import { InlineError, Panel } from "./ui";
import { useToast } from "./toast-provider";
import { useRouter } from "next/navigation";

export interface MediaRow {
  id: string;
  originalName: string;
  uploadedBy: string;
  createdAt: Date;
}

export function MediaSection({ media: served }: { media: MediaRow[] }) {
  const chart = useChart();
  const router = useRouter();
  const { toast } = useToast();
  const { run, pending, error } = useAction();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  // Uploads and deletes show immediately; the refreshed server list then takes over.
  const [added, setAdded] = useState<MediaRow[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const media = useMemo(
    () => [...served, ...added.filter((a) => !served.some((m) => m.id === a.id))].filter((m) => !removed.has(m.id)),
    [served, added, removed],
  );
  const touchX = useRef<number | null>(null);
  const open = openIndex === null ? null : (media[openIndex] ?? null);

  const show = (index: number | null) => {
    setZoomed(false);
    setOpenIndex(index);
  };
  const step = (by: number) => {
    if (openIndex === null || media.length < 2) return;
    show((openIndex + by + media.length) % media.length);
  };

  // Arrow keys move between photos while the viewer is open; the next and previous photo load ahead of time.
  useEffect(() => {
    if (openIndex === null) return;
    const total = media.length;
    for (const by of [1, -1]) new Image().src = `/api/media/${media[(openIndex + by + total) % total].id}`;
    const onKey = (e: KeyboardEvent) => {
      if (total < 2) return;
      const by = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!by) return;
      setZoomed(false);
      setOpenIndex((i) => (i === null ? i : (i + by + total) % total));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, media]);

  async function onUpload(item: FileDropzoneItem, o: { onProgress: (p: number) => void; signal: AbortSignal }) {
    const file = item.file;
    if (!file) throw new Error("No file selected.");
    const { key, contentType } = await uploadPhoto({
      admissionId: chart.admissionId,
      file,
      mode: chart.uploadMode,
      onProgress: (p) => o.onProgress(Math.min(p, 95)),
      signal: o.signal,
    }).catch(async (e: unknown) => {
      // createImageBitmap rejects with a DOMException when the browser cannot decode the photo (HEIC on Chrome, very large images).
      if (!(e instanceof DOMException) || e.name === "AbortError") throw e;
      throw new Error(undecodablePhotoMessage(sniffImageType(new Uint8Array(await file.slice(0, 12).arrayBuffer()))));
    });
    const res = await registerMedia({ admissionId: chart.admissionId, objectKey: key, contentType, originalName: item.name.slice(0, 120) });
    if (!res.ok) throw new Error(res.error);
    o.onProgress(100);
    setAdded((prev) => [...prev, { id: res.data.id, originalName: item.name.slice(0, 120), uploadedBy: res.data.uploadedBy, createdAt: res.data.createdAt }]);
    toast("Photo attached", item.name);
    router.refresh();
  }

  return (
    <Panel hue="cyan" title={`Lab photos (${media.length})`} description="Photos are compressed on this device and stored in private storage. They open through a link that expires in a minute.">
      {chart.allowed("media.attach") && (
        <div className="mb-4">
          <FileDropzone
            accept="image/*,.jpg,.jpeg,.png,.webp"
            multiple
            maxFiles={6}
            maxSize={25 * 1024 * 1024}
            label="Add lab photos"
            description="Take a photo or choose images from this device"
            onUpload={onUpload}
          />
        </div>
      )}
      {media.length === 0 ? (
        <EmptyState title="No lab photos" description="Attach photos of lab slips, ABG printouts or ECGs so the next shift can see them." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((m, index) => (
            <li key={m.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <button type="button" className="block aspect-[4/3] w-full overflow-hidden bg-surface-muted" onClick={() => show(index)} aria-label={`Open ${m.originalName || "lab photo"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${m.id}`} alt={m.originalName || "Lab photo"} loading="lazy" className="h-full w-full object-cover" />
              </button>
              <div className="flex flex-col items-start gap-1 px-2.5 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-2 sm:py-1.5">
                <span className="grid w-full min-w-0 text-xs text-text-secondary sm:w-auto" title={`${m.originalName} · ${m.uploadedBy}`}>
                  <span className="truncate font-medium text-foreground">{m.uploadedBy}</span>
                  <span className="truncate">{formatCairo(m.createdAt)}</span>
                </span>
                {chart.allowed("media.delete") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-ml-3 sm:ml-0"
                    disabled={pending}
                    aria-label={`Delete photo ${m.originalName || ""}`}
                    onClick={() => {
                      if (window.confirm("Delete this photo?")) void run(() => deleteMedia({ admissionId: chart.admissionId, mediaId: m.id }), () => {
                        setRemoved((prev) => new Set(prev).add(m.id));
                        if (openIndex !== null) show(null);
                      });
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <InlineError>{error}</InlineError>
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && show(null)}>
        {open && (
          <DialogContent
            className="sheet-form-dialog"
            title={open.originalName || "Lab photo"}
            description={`Uploaded by ${open.uploadedBy} on ${formatCairo(open.createdAt)}`}
          >
            <div
              className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-surface-muted/40"
              onTouchStart={(e) => {
                touchX.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                const start = touchX.current;
                touchX.current = null;
                if (start === null || zoomed) return;
                const dx = e.changedTouches[0].clientX - start;
                if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
              }}
            >
              <div className="grid min-h-full place-items-center p-3 sm:p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={open.id}
                  src={`/api/media/${open.id}`}
                  alt={open.originalName || "Lab photo"}
                  onClick={() => setZoomed((z) => !z)}
                  className={zoomed ? "w-[220%] max-w-none cursor-zoom-out rounded-lg" : "max-h-[62dvh] w-full cursor-zoom-in rounded-lg object-contain sm:max-h-[60vh]"}
                />
              </div>
              {media.length > 1 && !zoomed && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous photo"
                    className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface/90 shadow-md hover:bg-surface"
                  >
                    <ChevronLeft size={20} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next photo"
                    className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface/90 shadow-md hover:bg-surface"
                  >
                    <ChevronRight size={20} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
            <div className="flex-none grid gap-3 border-t border-border bg-surface-raised pt-3 pb-[calc(0.75rem+var(--dialog-safe-bottom,env(safe-area-inset-bottom)))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:pb-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">Uploaded by {open.uploadedBy}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {formatCairo(open.createdAt)} (Cairo){open.originalName ? ` · ${open.originalName}` : ""}
                  </p>
                </div>
                <span className="tnum shrink-0 text-xs text-text-secondary" aria-live="polite">
                  {(openIndex ?? 0) + 1} of {media.length}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <DialogClose asChild>
                  <Button variant="secondary">Close photo</Button>
                </DialogClose>
                <Button variant="ghost" onClick={() => setZoomed((z) => !z)} aria-label={zoomed ? "Zoom out" : "Zoom in"}>
                  {zoomed ? <ZoomOut size={16} aria-hidden="true" /> : <ZoomIn size={16} aria-hidden="true" />}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Panel>
  );
}
