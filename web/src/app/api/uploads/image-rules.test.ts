import { describe, expect, it } from "vitest";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  checkUploadMeta,
  sniffImageType,
  undecodablePhotoMessage,
} from "./image-rules";

describe("sniffImageType", () => {
  it("detects valid image formats from their magic bytes", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const webp = new TextEncoder().encode("RIFF....WEBP");
    const heic = new TextEncoder().encode("....ftypheic");
    const mif1 = new TextEncoder().encode("....ftypmif1");

    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(sniffImageType(heic)).toBe("image/heic");
    expect(sniffImageType(mif1)).toBe("image/heic");
  });

  it("returns null for random bytes, truncated buffers, or unrecognised headers", () => {
    expect(sniffImageType(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });

  it("identifies a file claiming to be JPEG with PNG bytes as PNG rather than JPEG", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(sniffImageType(pngBytes)).toBe("image/png");
    expect(sniffImageType(pngBytes)).not.toBe("image/jpeg");
  });
});

describe("checkUploadMeta", () => {
  it("accepts each allowed image type at normal size and exactly MAX_UPLOAD_BYTES", () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      expect(checkUploadMeta(type, 1024)).toBeNull();
      expect(checkUploadMeta(type, MAX_UPLOAD_BYTES)).toBeNull();
    }
  });

  it("rejects invalid content types with status 400", () => {
    const invalidTypes: unknown[] = ["image/heic", "", null, undefined, 123, {}];
    for (const type of invalidTypes) {
      expect(checkUploadMeta(type, 1024)).toEqual({
        status: 400,
        error: "Only WebP, JPEG or PNG images are allowed.",
      });
    }
  });

  it("rejects invalid sizes with status 413", () => {
    const invalidSizes: unknown[] = [0, -1, Number.NaN, MAX_UPLOAD_BYTES + 1];
    for (const size of invalidSizes) {
      expect(checkUploadMeta("image/jpeg", size)).toEqual({
        status: 413,
        error: `Photos must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      });
    }
  });
});

describe("undecodablePhotoMessage", () => {
  it("returns HEIC-specific advice for image/heic", () => {
    expect(undecodablePhotoMessage("image/heic")).toBe(
      "This browser cannot open HEIC photos. Use Take photo here, or set the camera to Most Compatible (iPhone) / turn off High efficiency pictures (Android).",
    );
  });

  it("returns generic advice for any other format or null", () => {
    const generic = "This device could not read that image. Take the photo again from here, or choose a JPEG.";
    expect(undecodablePhotoMessage(null)).toBe(generic);
    expect(undecodablePhotoMessage("image/jpeg")).toBe(generic);
    expect(undecodablePhotoMessage("image/png")).toBe(generic);
    expect(undecodablePhotoMessage("image/webp")).toBe(generic);
  });
});
