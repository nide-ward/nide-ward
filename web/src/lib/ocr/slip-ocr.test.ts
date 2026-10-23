import { describe, expect, it } from "vitest";
import {
  SLIP_OCR_MAX_SIDE,
  binarizeSlipPixels,
  cropSlipPaper,
  normalizeSlipPixels,
  prepareOcrPasses,
  preparePrimaryPixels,
  resizeSlipPixels,
  type RgbaImage,
} from "./slip-ocr";

function makeSolidImage(width: number, height: number, r: number, g: number, b: number, a = 255): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { data, width, height };
}

function setRect(
  img: RgbaImage,
  rect: { x0: number; y0: number; x1: number; y1: number },
  rgb: readonly [number, number, number],
): void {
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = rgb[0];
      img.data[i + 1] = rgb[1];
      img.data[i + 2] = rgb[2];
      img.data[i + 3] = 255;
    }
  }
}

function pixelAt(img: RgbaImage, x: number, y: number): readonly [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

describe("slip-ocr pure pixel pipeline", () => {
  it("crops coloured desk margins around a neutral slip while leaving close-up paper dimensions intact", () => {
    const closeUp = makeSolidImage(100, 160, 210, 210, 208);
    setRect(closeUp, { x0: 20, y0: 40, x1: 80, y1: 46 }, [25, 25, 25]);
    const uncropped = cropSlipPaper(closeUp);
    expect(uncropped.width).toBe(100);
    expect(uncropped.height).toBe(160);
    expect(pixelAt(uncropped, 30, 42)).toEqual([25, 25, 25, 255]);

    // Pink folder background (200, 138, 146) + dark bottom strip, with neutral paper in x=[24..114), y=[12..152)
    const framed = makeSolidImage(200, 200, 200, 138, 146);
    setRect(framed, { x0: 0, y0: 175, x1: 200, y1: 200 }, [65, 50, 38]);
    setRect(framed, { x0: 24, y0: 12, x1: 114, y1: 48 }, [130, 130, 128]); // shadowed top section of slip
    setRect(framed, { x0: 24, y0: 48, x1: 114, y1: 152 }, [215, 215, 212]); // lit section of slip
    setRect(framed, { x0: 50, y0: 70, x1: 80, y1: 80 }, [20, 20, 20]); // dark ink inside slip

    const cropped = cropSlipPaper(framed);
    expect(cropped.width).toBeGreaterThanOrEqual(90);
    expect(cropped.width).toBeLessThan(120);
    expect(cropped.height).toBeGreaterThanOrEqual(140);
    expect(cropped.height).toBeLessThan(165);

    // Ink inside the slip survives the crop
    let darkPixels = 0;
    for (let i = 0; i < cropped.data.length; i += 4) {
      if (cropped.data[i] === 20 && cropped.data[i + 1] === 20 && cropped.data[i + 2] === 20) darkPixels++;
    }
    expect(darkPixels).toBe(30 * 10);
  });

  it("resizes RGBA and normalized grayscale buffers accurately across box downscale and bilinear upscale", () => {
    const quadrant = makeSolidImage(40, 60, 0, 0, 0);
    setRect(quadrant, { x0: 0, y0: 0, x1: 20, y1: 30 }, [40, 80, 120]);
    setRect(quadrant, { x0: 20, y0: 0, x1: 40, y1: 30 }, [200, 100, 60]);
    setRect(quadrant, { x0: 0, y0: 30, x1: 40, y1: 60 }, [180, 180, 180]);

    const shrunk = resizeSlipPixels(quadrant, 20, 30);
    expect(shrunk.width).toBe(20);
    expect(shrunk.height).toBe(30);
    expect(pixelAt(shrunk, 2, 2)).toEqual([40, 80, 120, 255]);
    expect(pixelAt(shrunk, 17, 2)).toEqual([200, 100, 60, 255]);
    expect(pixelAt(shrunk, 10, 25)).toEqual([180, 180, 180, 255]);

    const cloned = resizeSlipPixels(shrunk, 20, 30);
    expect(cloned.data).not.toBe(shrunk.data);
    expect(Array.from(cloned.data)).toEqual(Array.from(shrunk.data));

    normalizeSlipPixels(shrunk.data, shrunk.width, shrunk.height);
    // Normalized buffer is opaque grayscale stretched across [0..255]
    expect(pixelAt(shrunk, 2, 2)[0]).toBe(0);
    expect(pixelAt(shrunk, 10, 25)).toEqual([255, 255, 255, 255]);
    for (let i = 0; i < shrunk.data.length; i += 4) {
      expect(shrunk.data[i]).toBe(shrunk.data[i + 1]);
      expect(shrunk.data[i + 1]).toBe(shrunk.data[i + 2]);
      expect(shrunk.data[i + 3]).toBe(255);
    }

    const upscaled = resizeSlipPixels(shrunk, 40, 60);
    expect(upscaled.width).toBe(40);
    expect(upscaled.height).toBe(60);
    expect(pixelAt(upscaled, 2, 2)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(upscaled, 20, 50)).toEqual([255, 255, 255, 255]);
    // Boundary between dark top-left (y < 30) and white bottom half (y >= 30) interpolates smoothly
    const midLeft = pixelAt(upscaled, 4, 29)[0];
    expect(midLeft).toBeGreaterThan(0);
    expect(midLeft).toBeLessThan(255);
  });

  it("fits oversized slips to SLIP_OCR_MAX_SIDE, binarizes ink, and pads only bright paper edges", () => {
    const oversized = makeSolidImage(110, SLIP_OCR_MAX_SIDE + 200, 220, 220, 220);
    setRect(oversized, { x0: 20, y0: 100, x1: 90, y1: 300 }, [25, 25, 25]);
    const fitted = preparePrimaryPixels(oversized);
    expect(fitted.height).toBe(SLIP_OCR_MAX_SIDE);
    expect(fitted.width).toBe(Math.round(110 * (SLIP_OCR_MAX_SIDE / (SLIP_OCR_MAX_SIDE + 200))));

    // Close-up slip with bright top/left/right paper edges and a dark bottom edge
    const edgeCase = makeSolidImage(60, 80, 225, 225, 225);
    setRect(edgeCase, { x0: 15, y0: 20, x1: 45, y1: 40 }, [20, 20, 20]);
    setRect(edgeCase, { x0: 0, y0: 79, x1: 60, y1: 80 }, [20, 20, 20]); // dark bottom edge -> not padded
    const primary = preparePrimaryPixels(edgeCase);
    const [primaryPass, enhancedPass] = prepareOcrPasses(primary);

    // Left (+24), right (+24), and top (+24) padded; dark bottom (+0) unpadded
    expect(primaryPass.width).toBe(60 + 48);
    expect(primaryPass.height).toBe(80 + 24);
    expect(pixelAt(primaryPass, 0, 0)).toEqual([255, 255, 255, 255]);

    expect(enhancedPass.height).toBe(SLIP_OCR_MAX_SIDE + 24);
    let invalidBinaryPixels = 0;
    let blackPixels = 0;
    let whitePixels = 0;
    for (let i = 0; i < enhancedPass.data.length; i += 4) {
      const v = enhancedPass.data[i];
      if ((v !== 0 && v !== 255) || enhancedPass.data[i + 1] !== v || enhancedPass.data[i + 2] !== v || enhancedPass.data[i + 3] !== 255) {
        invalidBinaryPixels++;
      } else if (v === 0) {
        blackPixels++;
      } else {
        whitePixels++;
      }
    }
    expect(invalidBinaryPixels).toBe(0);
    expect(blackPixels).toBeGreaterThan(0);
    expect(whitePixels).toBeGreaterThan(blackPixels);

    // Standalone binarizeSlipPixels separates bimodal grayscale intensities into pure 0 and 255
    const bimodal = makeSolidImage(10, 10, 230, 230, 230);
    setRect(bimodal, { x0: 2, y0: 2, x1: 6, y1: 6 }, [30, 30, 30]);
    binarizeSlipPixels(bimodal.data, bimodal.width, bimodal.height);
    expect(pixelAt(bimodal, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(bimodal, 3, 3)).toEqual([0, 0, 0, 255]);
  });
});
