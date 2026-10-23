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

import type { LoggerMessage, Worker } from "tesseract.js";

export type OcrFailure = "image" | "engine";

export class OcrError extends Error {
  constructor(
    public kind: OcrFailure,
    message: string,
  ) {
    super(message);
  }
}

/** 2000px preserves thermal glyph detail while keeping a phone-sized canvas manageable. */
export const SLIP_OCR_MAX_SIDE = 2000;
/** White quiet zone so glyphs touching a cropped photo edge are not dropped by Tesseract's line finder. */
const SLIP_OCR_BORDER = 24;

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

function downscaleBox(source: RgbaImage, width: number, height: number): RgbaImage {
  const { data: src, width: sw, height: sh } = source;
  const dst = new Uint8ClampedArray(width * height * 4);
  const scaleX = sw / width;
  const scaleY = sh / height;

  const xStarts = new Int32Array(width);
  const xCounts = new Int32Array(width);
  const maxTapX = Math.ceil(scaleX) + 2;
  const xWeights = new Float32Array(width * maxTapX);
  for (let x = 0; x < width; x++) {
    const sx0 = x * scaleX;
    const sx1 = (x + 1) * scaleX;
    const xStart = Math.floor(sx0);
    const xEnd = Math.min(sw - 1, Math.ceil(sx1) - 1);
    const count = xEnd - xStart + 1;
    const base = x * maxTapX;
    let wSum = 0;
    for (let i = 0; i < count; i++) {
      const sx = xStart + i;
      const w = Math.min(sx + 1, sx1) - Math.max(sx, sx0);
      xWeights[base + i] = w;
      wSum += w;
    }
    const invW = 1 / wSum;
    for (let i = 0; i < count; i++) xWeights[base + i] *= invW;
    xStarts[x] = xStart;
    xCounts[x] = count;
  }

  const rowLen = sw * 4;
  const rowBuf = new Float32Array(rowLen);
  const yWeights = new Float32Array(Math.ceil(scaleY) + 2);

  for (let y = 0; y < height; y++) {
    const sy0 = y * scaleY;
    const sy1 = (y + 1) * scaleY;
    const yStart = Math.floor(sy0);
    const yEnd = Math.min(sh - 1, Math.ceil(sy1) - 1);
    const yCount = yEnd - yStart + 1;
    let wSumY = 0;
    for (let j = 0; j < yCount; j++) {
      const sy = yStart + j;
      const w = Math.min(sy + 1, sy1) - Math.max(sy, sy0);
      yWeights[j] = w;
      wSumY += w;
    }
    const invWY = 1 / wSumY;
    for (let j = 0; j < yCount; j++) yWeights[j] *= invWY;

    const w0 = yWeights[0];
    let srcOff = yStart * rowLen;
    for (let i = 0; i < rowLen; i++) rowBuf[i] = src[srcOff + i] * w0;
    for (let j = 1; j < yCount; j++) {
      const wj = yWeights[j];
      srcOff = (yStart + j) * rowLen;
      for (let i = 0; i < rowLen; i++) rowBuf[i] += src[srcOff + i] * wj;
    }

    const dstRow = y * width * 4;
    for (let x = 0; x < width; x++) {
      const xStart = xStarts[x];
      const count = xCounts[x];
      const wBase = x * maxTapX;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let i = 0; i < count; i++) {
        const w = xWeights[wBase + i];
        const bi = (xStart + i) * 4;
        r += rowBuf[bi] * w;
        g += rowBuf[bi + 1] * w;
        b += rowBuf[bi + 2] * w;
        a += rowBuf[bi + 3] * w;
      }
      const di = dstRow + x * 4;
      dst[di] = (r + 0.5) | 0;
      dst[di + 1] = (g + 0.5) | 0;
      dst[di + 2] = (b + 0.5) | 0;
      dst[di + 3] = (a + 0.5) | 0;
    }
  }
  return { data: dst, width, height };
}

function isOpaqueGrayscale(data: Uint8ClampedArray): boolean {
  const step = Math.max(4, ((data.length >> 10) & ~3));
  for (let i = 0; i < data.length; i += step) {
    if (data[i] !== data[i + 1] || data[i] !== data[i + 2] || data[i + 3] !== 255) return false;
  }
  return true;
}

function resampleBilinear(source: RgbaImage, width: number, height: number): RgbaImage {
  const { data: src, width: sw, height: sh } = source;
  const dst = new Uint8ClampedArray(width * height * 4);
  const x0s = new Int32Array(width);
  const x1s = new Int32Array(width);
  const wxs = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const sx = Math.max(0, Math.min(sw - 1, (x + 0.5) * (sw / width) - 0.5));
    const x0 = Math.floor(sx);
    x0s[x] = x0 * 4;
    x1s[x] = Math.min(sw - 1, x0 + 1) * 4;
    wxs[x] = sx - x0;
  }
  const gray = isOpaqueGrayscale(src);
  for (let y = 0; y < height; y++) {
    const sy = Math.max(0, Math.min(sh - 1, (y + 0.5) * (sh / height) - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = sy - y0;
    const wy0 = 1 - wy;
    const row0 = y0 * sw * 4;
    const row1 = y1 * sw * 4;
    const dstRow = y * width * 4;
    if (gray) {
      for (let x = 0; x < width; x++) {
        const wx = wxs[x];
        const wx0 = 1 - wx;
        const top = src[row0 + x0s[x]] * wx0 + src[row0 + x1s[x]] * wx;
        const bot = src[row1 + x0s[x]] * wx0 + src[row1 + x1s[x]] * wx;
        const v = (top * wy0 + bot * wy + 0.5) | 0;
        const di = dstRow + x * 4;
        dst[di] = v;
        dst[di + 1] = v;
        dst[di + 2] = v;
        dst[di + 3] = 255;
      }
    } else {
      for (let x = 0; x < width; x++) {
        const wx = wxs[x];
        const wx0 = 1 - wx;
        const i00 = row0 + x0s[x];
        const i10 = row0 + x1s[x];
        const i01 = row1 + x0s[x];
        const i11 = row1 + x1s[x];
        const di = dstRow + x * 4;
        for (let c = 0; c < 4; c++) {
          const top = src[i00 + c] * wx0 + src[i10 + c] * wx;
          const bot = src[i01 + c] * wx0 + src[i11 + c] * wx;
          dst[di + c] = (top * wy0 + bot * wy + 0.5) | 0;
        }
      }
    }
  }
  return { data: dst, width, height };
}

/**
 * Pure RGBA resampler shared between the browser scanner and Node evaluator so both run the exact
 * same pixels: area-average box filter when shrinking, half-pixel bilinear when upscaling.
 */
export function resizeSlipPixels(source: RgbaImage, width: number, height: number): RgbaImage {
  if (width === source.width && height === source.height) {
    return { data: new Uint8ClampedArray(source.data), width, height };
  }
  if (width <= source.width && height <= source.height) {
    return downscaleBox(source, width, height);
  }
  return resampleBilinear(source, width, height);
}

/**
 * Converts RGBA image pixels to grayscale and stretches their contrast. Kept independent of the
 * canvas so the slip evaluator can exercise the exact same processing in Node.
 */
export function normalizeSlipPixels(data: Uint8ClampedArray, width: number, height: number): void {
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = v;
    hist[v]++;
  }
  // Stretch between the 2nd and 98th percentile so faint thermal print and shadows both become readable.
  const total = width * height;
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
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    lut[v] = ((v - lo) * 255) / range;
  }
  for (let i = 0; i < data.length; i += 4) {
    const v = lut[data[i]];
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
}

/** Binarizes normalized grayscale pixels with Otsu's threshold, preserving only the darkest text. */
export function binarizeSlipPixels(data: Uint8ClampedArray, width: number, height: number): void {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) histogram[data[i]]++;

  const total = width * height;
  let allIntensity = 0;
  for (let value = 0; value < histogram.length; value++) allIntensity += value * histogram[value];

  let backgroundIntensity = 0;
  let backgroundPixels = 0;
  let highestVariance = 0;
  let threshold = 0;
  for (let value = 0; value < histogram.length; value++) {
    backgroundPixels += histogram[value];
    if (backgroundPixels === 0) continue;
    const foregroundPixels = total - backgroundPixels;
    if (foregroundPixels === 0) break;
    backgroundIntensity += value * histogram[value];
    const meanDifference = backgroundIntensity / backgroundPixels - (allIntensity - backgroundIntensity) / foregroundPixels;
    const variance = backgroundPixels * foregroundPixels * meanDifference * meanDifference;
    if (variance > highestVariance) {
      highestVariance = variance;
      threshold = value;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] <= threshold ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = value;
    data[i + 3] = 255;
  }
}

interface EdgePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function detectPaperEdgePadding(image: RgbaImage, border: number): EdgePadding {
  const { data, width, height } = image;
  let topBright = 0;
  let bottomBright = 0;
  for (let x = 0; x < width; x++) {
    if (data[x * 4] >= 160) topBright++;
    if (data[((height - 1) * width + x) * 4] >= 160) bottomBright++;
  }
  let leftBright = 0;
  let rightBright = 0;
  for (let y = 0; y < height; y++) {
    if (data[y * width * 4] >= 160) leftBright++;
    if (data[(y * width + (width - 1)) * 4] >= 160) rightBright++;
  }
  return {
    top: topBright / width >= 0.75 ? border : 0,
    right: rightBright / height >= 0.75 ? border : 0,
    bottom: bottomBright / width >= 0.75 ? border : 0,
    left: leftBright / height >= 0.75 ? border : 0,
  };
}

function padSlipEdges(image: RgbaImage, pad: EdgePadding): RgbaImage {
  if (pad.top === 0 && pad.right === 0 && pad.bottom === 0 && pad.left === 0) return image;
  const width = image.width + pad.left + pad.right;
  const height = image.height + pad.top + pad.bottom;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  const rowBytes = image.width * 4;
  for (let y = 0; y < image.height; y++) {
    const srcOffset = y * rowBytes;
    const dstOffset = ((y + pad.top) * width + pad.left) * 4;
    data.set(image.data.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
  }
  return { data, width, height };
}

/**
 * Trims non-paper desk or folder margins around a photographed thermal slip before resizing and
 * contrast stretching, using scene-relative paper colour so warm indoor light and shadows survive.
 */
export function cropSlipPaper(source: RgbaImage): RgbaImage {
  const { data, width, height } = source;
  const stepX = Math.max(1, Math.floor(width / 200));
  const stepY = Math.max(1, Math.floor(height / 300));
  const gw = Math.floor(width / stepX);
  const gh = Math.floor(height / stepY);
  if (gw < 20 || gh < 20) return source;

  const totalSamples = gw * gh;
  const lums = new Uint8Array(totalSamples);
  const rgDiff = new Int16Array(totalSamples);
  const bgDiff = new Int16Array(totalSamples);
  const lumHist = new Uint32Array(256);

  let sampleIdx = 0;
  for (let gy = 0; gy < gh; gy++) {
    const rowOff = gy * stepY * width * 4;
    for (let gx = 0; gx < gw; gx++) {
      const i = rowOff + gx * stepX * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (77 * r + 150 * g + 29 * b) >> 8;
      lums[sampleIdx] = lum;
      rgDiff[sampleIdx] = r - g;
      bgDiff[sampleIdx] = b - g;
      lumHist[lum]++;
      sampleIdx++;
    }
  }

  let brightThreshold = 255;
  for (let acc = 0; brightThreshold > 0; brightThreshold--) {
    acc += lumHist[brightThreshold];
    if (acc >= totalSamples * 0.2) break;
  }

  let refLumSum = 0;
  let refRgSum = 0;
  let refBgSum = 0;
  let refCount = 0;
  for (let i = 0; i < totalSamples; i++) {
    if (lums[i] >= brightThreshold) {
      refLumSum += lums[i];
      refRgSum += rgDiff[i];
      refBgSum += bgDiff[i];
      refCount++;
    }
  }
  if (refCount === 0) return source;

  const refLum = refLumSum / refCount;
  const refRg = refRgSum / refCount;
  const refBg = refBgSum / refCount;
  const minPaperLum = refLum * 0.42;
  const maxColorDist = 36;

  const colPaper = new Uint16Array(gw);
  for (let gy = 0; gy < gh; gy++) {
    const base = gy * gw;
    for (let gx = 0; gx < gw; gx++) {
      const i = base + gx;
      const colorDist = Math.abs(rgDiff[i] - refRg) + Math.abs(bgDiff[i] - refBg);
      if (lums[i] >= minPaperLum && colorDist <= maxColorDist) colPaper[gx]++;
    }
  }

  const colThresh = gh * 0.3;
  let gx0 = 0;
  let gx1 = gw - 1;
  while (gx0 < gw && colPaper[gx0] < colThresh) gx0++;
  while (gx1 > gx0 && colPaper[gx1] < colThresh) gx1--;
  if (gx1 - gx0 + 1 < gw * 0.25) return source;

  const spanW = gx1 - gx0 + 1;
  const rowSpanPaper = new Uint16Array(gh);
  for (let gy = 0; gy < gh; gy++) {
    const base = gy * gw;
    let count = 0;
    for (let gx = gx0; gx <= gx1; gx++) {
      const i = base + gx;
      const colorDist = Math.abs(rgDiff[i] - refRg) + Math.abs(bgDiff[i] - refBg);
      if (lums[i] >= minPaperLum && colorDist <= maxColorDist) count++;
    }
    rowSpanPaper[gy] = count;
  }

  const rowThresh = spanW * 0.35;
  let gy0 = 0;
  let gy1 = gh - 1;
  while (gy0 < gh && rowSpanPaper[gy0] < rowThresh) gy0++;
  while (gy1 > gy0 && rowSpanPaper[gy1] < rowThresh) gy1--;
  if (gy1 - gy0 + 1 < gh * 0.35) return source;

  const padX = Math.round(width * 0.015);
  const padY = Math.round(height * 0.015);
  const x0 = Math.max(0, gx0 * stepX - padX);
  const x1 = Math.min(width, (gx1 + 1) * stepX + padX);
  const y0 = Math.max(0, gy0 * stepY - padY);
  const y1 = Math.min(height, (gy1 + 1) * stepY + padY);
  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw * ch >= width * height * 0.9) return source;

  const out = new Uint8ClampedArray(cw * ch * 4);
  const rowBytes = cw * 4;
  for (let y = 0; y < ch; y++) {
    const srcOff = ((y0 + y) * width + x0) * 4;
    out.set(data.subarray(srcOff, srcOff + rowBytes), y * rowBytes);
  }
  return { data: out, width: cw, height: ch };
}

export function preparePrimaryPixels(source: RgbaImage): RgbaImage {
  const cropped = cropSlipPaper(source);
  const scale = Math.min(1, SLIP_OCR_MAX_SIDE / Math.max(cropped.width, cropped.height));
  const width = Math.max(1, Math.round(cropped.width * scale));
  const height = Math.max(1, Math.round(cropped.height * scale));
  const resized = resizeSlipPixels(cropped, width, height);
  normalizeSlipPixels(resized.data, resized.width, resized.height);
  return resized;
}

export function prepareEnhancedPixels(primary: RgbaImage): RgbaImage {
  const scale = SLIP_OCR_MAX_SIDE / Math.max(primary.width, primary.height);
  const width = Math.max(1, Math.round(primary.width * scale));
  const height = Math.max(1, Math.round(primary.height * scale));
  const resized = resizeSlipPixels(primary, width, height);
  binarizeSlipPixels(resized.data, resized.width, resized.height);
  return resized;
}

/** Builds the primary and binarized OCR pass images with white quiet zones on cropped paper edges. */
export function prepareOcrPasses(primary: RgbaImage): readonly [RgbaImage, RgbaImage] {
  const pad = detectPaperEdgePadding(primary, SLIP_OCR_BORDER);
  const enhanced = prepareEnhancedPixels(primary);
  return [padSlipEdges(primary, pad), padSlipEdges(enhanced, pad)];
}

function rgbaToCanvas(image: RgbaImage): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new OcrError("image", "This browser cannot process images.");
  const pixels =
    image.data.buffer instanceof ArrayBuffer
      ? new Uint8ClampedArray(image.data.buffer, image.data.byteOffset, image.data.length)
      : new Uint8ClampedArray(image.data);
  ctx.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
  return canvas;
}

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
  const fullCanvas = document.createElement("canvas");
  fullCanvas.width = source.width;
  fullCanvas.height = source.height;
  const fullCtx = fullCanvas.getContext("2d", { willReadFrequently: true });
  if (!fullCtx) {
    if ("close" in source && typeof source.close === "function") source.close();
    throw new OcrError("image", "This browser cannot process images.");
  }
  fullCtx.drawImage(source, 0, 0);
  if ("close" in source && typeof source.close === "function") source.close();
  const fullImage = fullCtx.getImageData(0, 0, fullCanvas.width, fullCanvas.height);
  fullCanvas.width = 0;
  fullCanvas.height = 0;

  const primary = preparePrimaryPixels({
    data: fullImage.data,
    width: fullImage.width,
    height: fullImage.height,
  });
  return rgbaToCanvas(primary);
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

let activeLogger: ((m: LoggerMessage) => void) | null = null;
let cachedWorkerPromise: Promise<Worker> | null = null;
let workerQueue: Promise<void> = Promise.resolve();

async function createOcrWorker(): Promise<Worker> {
  const mod = await import("tesseract.js").catch(() => {
    throw new OcrError("engine", "The reader could not be loaded.");
  });
  const createWorker = mod.createWorker ?? mod.default?.createWorker;
  if (!createWorker) throw new OcrError("engine", "The reader could not be loaded.");
  const logger = (m: LoggerMessage) => activeLogger?.(m);

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

  try {
    return await start(true);
  } catch {
    try {
      return await start(false);
    } catch {
      throw new OcrError("engine", "The reader could not start.");
    }
  }
}

function getOcrWorker(): Promise<Worker> {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = createOcrWorker().catch((err: unknown) => {
      cachedWorkerPromise = null;
      throw err;
    });
  }
  return cachedWorkerPromise;
}

/** Warms the OCR worker and language model when the scanner opens. Errors are ignored; readSlipText reports real failures. */
export function preloadOcr() {
  if (typeof window === "undefined") return;
  void getOcrWorker().catch(() => {});
}

function ocrPassCanvases(canvas: HTMLCanvasElement): readonly [HTMLCanvasElement, HTMLCanvasElement] {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new OcrError("image", "This browser cannot process images.");
  const primary = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const [primaryPass, enhancedPass] = prepareOcrPasses({
    data: primary.data,
    width: primary.width,
    height: primary.height,
  });
  return [rgbaToCanvas(primaryPass), rgbaToCanvas(enhancedPass)];
}

/**
 * Reads the text twice on-device: the normal contrast image and an upscaled Otsu-binarized image.
 * The caller must merge the independent readings conservatively, field by field.
 */
export async function readSlipText(canvas: HTMLCanvasElement, onProgress: (p: OcrProgress) => void): Promise<readonly [string, string]> {
  const runJob = async (): Promise<readonly [string, string]> => {
    let passBase = 0;
    activeLogger = (m) => {
      const p = friendly(m.status, m.progress);
      onProgress(p.fraction === null ? p : { label: p.label, fraction: passBase + p.fraction * 0.5 });
    };
    const worker = await getOcrWorker();
    try {
      const [primaryPass, enhancedPass] = ocrPassCanvases(canvas);
      const primary = await worker.recognize(primaryPass);
      passBase = 0.5;
      const enhanced = await worker.recognize(enhancedPass);
      return [primary.data.text, enhanced.data.text];
    } catch (err) {
      cachedWorkerPromise = null;
      await worker.terminate().catch(() => {});
      throw err;
    } finally {
      activeLogger = null;
    }
  };

  const resultPromise = workerQueue.then(runJob, runJob);
  workerQueue = resultPromise.then(
    () => undefined,
    () => undefined,
  );
  return resultPromise;
}
