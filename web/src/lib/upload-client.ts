"use client";

const MAX_DIM = 1600;

/** Resize to at most 1600 px and encode as WebP (JPEG where the browser cannot encode WebP). */
export async function compressImage(file: File): Promise<{ blob: Blob; contentType: "image/webp" | "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
  const webp = await toBlob("image/webp", 0.8);
  if (webp && webp.type === "image/webp") return { blob: webp, contentType: "image/webp" };
  const jpeg = await toBlob("image/jpeg", 0.82);
  if (!jpeg) throw new Error("Could not compress that image.");
  return { blob: jpeg, contentType: "image/jpeg" };
}

function putWithProgress(url: string, blob: Blob, contentType: string, onProgress: (p: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage rejected the upload (${xhr.status}). Check the bucket CORS settings.`));
    xhr.onerror = () => reject(new Error("Could not reach photo storage. If this keeps happening, the bucket may need CORS or proxy upload mode."));
    signal.addEventListener("abort", () => {
      xhr.abort();
      reject(new Error("Cancelled"));
    });
    xhr.send(blob);
  });
}

/**
 * Compresses and stores a photo. Returns the object key to register with the server.
 * mode "presigned": ask for a presigned PUT, then upload straight to the bucket.
 * mode "proxy": POST to the authenticated route, which stores it server-side.
 */
export async function uploadPhoto(opts: {
  admissionId: string;
  file: File;
  mode: "presigned" | "proxy";
  onProgress: (p: number) => void;
  signal: AbortSignal;
}): Promise<{ key: string; contentType: string }> {
  const { blob, contentType } = await compressImage(opts.file);
  if (opts.mode === "proxy") {
    const form = new FormData();
    form.set("admissionId", opts.admissionId);
    form.set("file", new File([blob], "photo", { type: contentType }));
    const res = await fetch("/api/uploads/proxy", { method: "POST", body: form, signal: opts.signal });
    const json = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
    if (!res.ok || !json.key) throw new Error(json.error ?? "Upload failed.");
    opts.onProgress(100);
    return { key: json.key, contentType };
  }
  const res = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admissionId: opts.admissionId, contentType, size: blob.size }),
    signal: opts.signal,
  });
  const json = (await res.json().catch(() => ({}))) as { url?: string; key?: string; error?: string };
  if (!res.ok || !json.url || !json.key) throw new Error(json.error ?? "Could not start the upload.");
  await putWithProgress(json.url, blob, contentType, opts.onProgress, opts.signal);
  return { key: json.key, contentType };
}
