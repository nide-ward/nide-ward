"use client";

import { useState } from "react";
import Button from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import EmptyState from "@/components/arc/empty-state/empty-state";
import FileDropzone, { type FileDropzoneItem } from "@/components/arc/file-dropzone/file-dropzone";
import { deleteMedia, registerMedia } from "@/server/actions/media";
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

export function MediaSection({ media }: { media: MediaRow[] }) {
  const chart = useChart();
  const router = useRouter();
  const { toast } = useToast();
  const { run, pending, error } = useAction();
  const [open, setOpen] = useState<MediaRow | null>(null);

  async function onUpload(item: FileDropzoneItem, o: { onProgress: (p: number) => void; signal: AbortSignal }) {
    if (!item.file) throw new Error("No file selected.");
    const { key, contentType } = await uploadPhoto({
      admissionId: chart.admissionId,
      file: item.file,
      mode: chart.uploadMode,
      onProgress: (p) => o.onProgress(Math.min(p, 95)),
      signal: o.signal,
    });
    const res = await registerMedia({ admissionId: chart.admissionId, objectKey: key, contentType, originalName: item.name.slice(0, 120) });
    if (!res.ok) throw new Error(res.error);
    o.onProgress(100);
    toast("Photo attached", item.name);
    router.refresh();
  }

  return (
    <Panel hue="cyan" title={`Lab photos (${media.length})`} description="Photos are compressed on this device and stored in private storage. They open through a link that expires in a minute.">
      {chart.allowed("media.attach") && (
        <div className="mb-4">
          <FileDropzone
            accept="image/*"
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
          {media.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              <button type="button" className="block aspect-[4/3] w-full overflow-hidden bg-surface-muted" onClick={() => setOpen(m)} aria-label={`Open ${m.originalName || "lab photo"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${m.id}`} alt={m.originalName || "Lab photo"} loading="lazy" className="h-full w-full object-cover" />
              </button>
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                <span className="min-w-0 truncate text-text-secondary" title={`${m.originalName} · ${m.uploadedBy}`}>
                  {formatCairo(m.createdAt)}
                </span>
                {chart.allowed("media.delete") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    aria-label={`Delete photo ${m.originalName || ""}`}
                    onClick={() => {
                      if (window.confirm("Delete this photo?")) void run(() => deleteMedia({ admissionId: chart.admissionId, mediaId: m.id }));
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
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <DialogContent title={open.originalName || "Lab photo"} description={`Attached ${formatCairo(open.createdAt)} by ${open.uploadedBy}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${open.id}`} alt={open.originalName || "Lab photo"} className="max-h-[60vh] w-full rounded-lg object-contain" />
            <DialogClose asChild>
              <Button variant="secondary">Close photo</Button>
            </DialogClose>
          </DialogContent>
        )}
      </Dialog>
    </Panel>
  );
}
