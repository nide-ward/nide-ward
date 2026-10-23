/** Upload rules shared by the upload routes, the register action and the client. No server-only imports. */

export const ALLOWED_IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // photos are compressed to ~1600px WebP client-side, so this is generous

export type ImageFormat = AllowedImageType | "image/heic";

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/** Identifies an image from its first 12 bytes, ignoring whatever type the browser or client claims. */
export function sniffImageType(b: Uint8Array): ImageFormat | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return "image/png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (ascii(b, 4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(b, 8, 12))) return "image/heic";
  return null;
}

export type UploadRejection = { status: number; error: string };

/** Type and size rules for a photo that is about to be stored. */
export function checkUploadMeta(contentType: unknown, size: unknown): UploadRejection | null {
  if (typeof contentType !== "string" || !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    return { status: 400, error: "Only WebP, JPEG or PNG images are allowed." };
  }
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    return { status: 413, error: `Photos must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  }
  return null;
}

/** Message for a photo the browser could not decode, so the user knows what to change on the phone. */
export function undecodablePhotoMessage(format: ImageFormat | null): string {
  if (format === "image/heic") {
    return "This browser cannot open HEIC photos. Use Take photo here, or set the camera to Most Compatible (iPhone) / turn off High efficiency pictures (Android).";
  }
  return "This device could not read that image. Take the photo again from here, or choose a JPEG.";
}
