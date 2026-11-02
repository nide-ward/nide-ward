const PAGE_WIDTH_PX = 794; // A4 width at 96 dpi
const PAGE_HEIGHT_PX = 1123; // A4 height at 96 dpi
const MARGIN_PX = 45; // about 12 mm
const SCALE = 2;
const BLOCK_SELECTOR = "tr, h2, p, li";

const safeFileName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "chart";

/** Offsets (px from the sheet's top) where a page may end without cutting through a row or paragraph. */
function breakCandidates(sheet: HTMLElement): number[] {
  const top = sheet.getBoundingClientRect().top;
  return Array.from(sheet.querySelectorAll(BLOCK_SELECTOR), (el) => el.getBoundingClientRect().bottom - top).sort((a, b) => a - b);
}

/** Loads a print page in an off-screen frame, renders it to A4 pages and downloads the PDF. */
export async function downloadPrintPdf(url: string, title: string): Promise<void> {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;border:0`;
  try {
    await new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error("print page failed to load"));
      frame.src = url;
      document.body.appendChild(frame);
    });
    const doc = frame.contentDocument;
    const sheet = doc?.querySelector<HTMLElement>(".print-sheet");
    if (!doc || !sheet) throw new Error("print page has no sheet");
    await doc.fonts?.ready;

    sheet.style.cssText += `;max-width:none;width:${PAGE_WIDTH_PX}px;padding:${MARGIN_PX}px`;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    const canvas = await html2canvas(sheet, { scale: SCALE, backgroundColor: "#ffffff", useCORS: true, windowWidth: PAGE_WIDTH_PX });

    const breaks = breakCandidates(sheet);
    const usable = PAGE_HEIGHT_PX - MARGIN_PX; // content space left under the top margin of a continued page
    const total = sheet.getBoundingClientRect().height;
    const pdf = new jsPDF({ unit: "px", format: [PAGE_WIDTH_PX, PAGE_HEIGHT_PX], hotfixes: ["px_scaling"] });

    let start = 0;
    let page = 0;
    while (start < total - 1) {
      const limit = start + (page === 0 ? PAGE_HEIGHT_PX : usable);
      const fits = breaks.filter((b) => b > start + 40 && b <= limit);
      const end = limit >= total ? total : fits.length ? fits[fits.length - 1] : limit;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.max(1, Math.round((end - start) * SCALE));
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, Math.round(start * SCALE), canvas.width, slice.height, 0, 0, slice.width, slice.height);
      if (page > 0) pdf.addPage([PAGE_WIDTH_PX, PAGE_HEIGHT_PX]);
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, page === 0 ? 0 : MARGIN_PX, PAGE_WIDTH_PX, end - start);
      start = end;
      page++;
    }
    pdf.save(`${safeFileName(title)}.pdf`);
  } finally {
    frame.remove();
  }
}
