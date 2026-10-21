// Copies the Tesseract.js worker, wasm core and English language data into public/ocr so the
// blood gas slip scanner works on networks that block the public CDNs Tesseract uses by default.
// Run by postinstall and prebuild. public/ocr is generated, not committed.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const out = join(process.cwd(), "public", "ocr");

try {
  const tessDir = dirname(require.resolve("tesseract.js/package.json"));
  const coreDir = dirname(require.resolve("tesseract.js-core/package.json"));
  const langDir = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
  mkdirSync(join(out, "core"), { recursive: true });
  mkdirSync(join(out, "lang"), { recursive: true });
  cpSync(join(tessDir, "dist", "worker.min.js"), join(out, "worker.min.js"));
  for (const f of readdirSync(coreDir)) {
    if (f.endsWith("-lstm.wasm.js")) cpSync(join(coreDir, f), join(out, "core", f));
  }
  const lang = join(langDir, "4.0.0_best_int", "eng.traineddata.gz");
  if (existsSync(lang)) cpSync(lang, join(out, "lang", "eng.traineddata.gz"));
  console.log("OCR assets copied to public/ocr");
} catch (err) {
  // Not fatal: the scanner falls back to Tesseract's CDN, then to pasted text.
  console.warn("Could not copy OCR assets:", err instanceof Error ? err.message : err);
}
