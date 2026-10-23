import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { z } from "zod";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { parseABGSlipTexts } from "../src/lib/clinical/slip-parser";
import { prepareOcrPasses, preparePrimaryPixels, type RgbaImage } from "../src/lib/ocr/slip-ocr";

const fieldSchema = z.number().nullable();
const truthSchema = z.record(z.string(), z.union([z.record(z.string(), fieldSchema), z.string()]));
const fields = ["ph", "pco2", "po2", "hco3", "hco3std", "na", "k", "cl", "ca", "rbg", "hb"] as const;
type Result = "correct" | "missing" | "WRONG";

function classify(expected: number | null, actual: number | undefined): Result {
  if (expected === null) return actual === undefined ? "correct" : "WRONG";
  if (actual === undefined) return "missing";
  return actual === expected ? "correct" : "WRONG";
}

function verifyComparisonControls(): void {
  if (classify(7.4, 7.4) !== "correct" || classify(7.4, undefined) !== "missing" || classify(7.4, 7.5) !== "WRONG") {
    throw new Error("Evaluator comparison controls failed.");
  }
}

/** Strips sharp's default 25-dpi pHYs chunk so Node PNGs match HTMLCanvasElement.toBlob() in the browser. */
function stripPngPhys(png: Buffer): Buffer {
  const chunks: Buffer[] = [png.subarray(0, 8)];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    if (type !== "pHYs") chunks.push(png.subarray(offset, offset + 12 + length));
    offset += 12 + length;
  }
  return Buffer.concat(chunks);
}

async function encodeCanvasPng(image: RgbaImage): Promise<Buffer> {
  const raw = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  const png = await sharp(raw, { raw: { width: image.width, height: image.height, channels: 4 } }).png().toBuffer();
  return stripPngPhys(png);
}

async function prepareForOcr(path: string): Promise<readonly [Buffer, Buffer]> {
  const { data, info } = await sharp(path).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const full: RgbaImage = {
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
  const [primary, enhanced] = prepareOcrPasses(preparePrimaryPixels(full));
  return [await encodeCanvasPng(primary), await encodeCanvasPng(enhanced)];
}

async function main(): Promise<void> {
  verifyComparisonControls();
  const showText = process.argv.includes("--show-text");
  const [folder, truthPath] = process.argv.slice(2).filter((argument) => argument !== "--show-text");
  if (!folder || !truthPath) throw new Error("Usage: bun scripts/eval-slips.ts <photos-folder> <truth.json>");

  const parsedTruth = truthSchema.safeParse(JSON.parse(await readFile(truthPath, "utf8")));
  if (!parsedTruth.success) throw new Error(`Invalid truth JSON: ${parsedTruth.error.message}`);
  const truth = parsedTruth.data;
  const photos = (await readdir(folder)).filter((file) => [".jpg", ".jpeg", ".png"].includes(extname(file).toLowerCase())).sort();
  const worker = await createWorker("eng", 1, {
    langPath: join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int"),
    cacheMethod: "none",
  });
  const totals: Record<Result, number> = { correct: 0, missing: 0, WRONG: 0 };

  try {
    for (const photo of photos) {
      const row = truth[photo];
      if (!row || typeof row === "string") throw new Error(`No field truth for ${photo}`);
      const startedAt = performance.now();
      const [primaryImage, enhancedImage] = await prepareForOcr(join(folder, photo));
      const primary = await worker.recognize(primaryImage);
      const enhanced = await worker.recognize(enhancedImage);
      const result = parseABGSlipTexts([primary.data.text, enhanced.data.text]);
      const elapsedMs = Math.round(performance.now() - startedAt);
      const statuses: string[] = [];
      const counts: Record<Result, number> = { correct: 0, missing: 0, WRONG: 0 };
      for (const field of fields) {
        const expected = row[field];
        if (expected === undefined) continue;
        if (typeof expected !== "number" && expected !== null) throw new Error(`Invalid ${field} truth for ${photo}`);
        const status = classify(expected, result[field]);
        counts[status]++;
        totals[status]++;
        statuses.push(`${field}=${status}${status === "WRONG" ? `(${result[field] ?? "blank"} != ${expected ?? "blank"})` : ""}`);
      }
      console.log(`${basename(photo)}: ${counts.correct} correct / ${counts.missing} missing / ${counts.WRONG} WRONG (${elapsedMs}ms)`);
      console.log(`  ${statuses.join("; ")}`);
      if (showText) console.log(`  OCR (primary):\n${primary.data.text}\n  OCR (enhanced):\n${enhanced.data.text}`);
    }
  } finally {
    await worker.terminate();
  }
  console.log(`TOTAL: ${totals.correct} correct / ${totals.missing} missing / ${totals.WRONG} WRONG`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
