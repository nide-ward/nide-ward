/**
 * Browser-only OCR for blood gas analyser slips. Tesseract.js is imported lazily, the first time the
 * scanner opens, so it stays out of the main bundle. Everything runs on the device: the photo is drawn
 * to a canvas, read, and dropped. Nothing is uploaded or stored.
 *
 * Tesseract fetches three things: its worker script, the wasm core and the English language data. By
 * default it loads them from the jsDelivr CDN. scripts/copy-ocr-assets.mjs copies them to /ocr on this
 * server, which works on hospital networks that block CDNs; the CDN is only a fallback if the local
 * copies are missing.
 */

export type OcrFailure = "image" | "engine";

export class OcrError extends Error {
  constructor(
    public kind: OcrFailure,
    message: string,
  ) {
    super(message);
  }
}

const MAX_SIDE = 1600;

/** Loads the photo (honouring camera rotation), shrinks it, and stretches it to grayscale with full contrast. */
export async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  let source: CanvasImageSource & { width: number; height: number };
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new OcrError("image", "That file could not be opened as a photo."));
      };
      img.src = url;
    });
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new OcrError("image", "This browser cannot process images.");
  ctx.drawImage(source, 0, 0, w, h);
  if ("close" in source && typeof source.close === "function") source.close();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = v;
    hist[v]++;
  }
  // Stretch between the 2nd and 98th percentile so faint thermal print and shadows both become readable.
  const total = w * h;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255; lo++) {
    acc += hist[lo];
    if (acc >= total * 0.02) break;
  }
  for (let acc = 0; hi > 0; hi--) {
    acc += hist[hi];
    if (acc >= total * 0.02) break;
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export interface OcrProgress {
  /** Friendly label for the current stage. */
  label: string;
  /** 0 to 1 while reading; null while loading (no meaningful fraction). */
  fraction: number | null;
}

const LOCAL = { workerPath: "/ocr/worker.min.js", corePath: "/ocr/core", langPath: "/ocr/lang" };
const START_TIMEOUT_MS = 60_000;

function friendly(status: string, progress: number): OcrProgress {
  if (status === "recognizing text") return { label: "Reading the slip", fraction: progress };
  return { label: "Loading the reader (first time only)", fraction: null };
}

/** Warms the module cache when the scanner opens. Errors are ignored; readSlipText reports real failures. */
export function preloadOcr() {
  void import("tesseract.js").catch(() => {});
}

/** Reads the text on the slip photo. Throws OcrError("engine") if Tesseract cannot start from either source. */
export async function readSlipText(canvas: HTMLCanvasElement, onProgress: (p: OcrProgress) => void): Promise<string> {
  const mod = await import("tesseract.js").catch(() => {
    throw new OcrError("engine", "The reader could not be loaded.");
  });
  const createWorker = mod.createWorker ?? mod.default?.createWorker;
  if (!createWorker) throw new OcrError("engine", "The reader could not be loaded.");
  const logger = (m: { status: string; progress: number }) => onProgress(friendly(m.status, m.progress));

  const start = async (local: boolean) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), START_TIMEOUT_MS);
    });
    try {
      // OEM 1 is the LSTM engine, the same one the CDN build uses.
      return await Promise.race([createWorker("eng", 1, local ? { ...LOCAL, logger } : { logger }), timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

  let worker: Awaited<ReturnType<typeof start>>;
  try {
    worker = await start(true);
  } catch {
    try {
      worker = await start(false);
    } catch {
      throw new OcrError("engine", "The reader could not start.");
    }
  }
  try {
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    await worker.terminate().catch(() => {});
  }
}
