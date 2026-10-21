import "server-only";
import { and, eq } from "drizzle-orm";
import { getReadDb, schema } from "@/db";
import { can } from "@/lib/permissions";
import { getStaff } from "@/lib/session";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/storage";

export type Guard = { ok: true; staffName: string } | { ok: false; status: number; error: string };

/** Auth + role + admission + type + size checks shared by the presign and proxy upload routes. */
export async function guardUpload(admissionId: unknown, contentType: unknown, size: unknown): Promise<Guard> {
  const staff = await getStaff();
  if (!staff) return { ok: false, status: 401, error: "Sign in again." };
  if (!can(staff.role, "media.attach")) return { ok: false, status: 403, error: "Your role cannot attach photos." };
  if (typeof admissionId !== "string" || !/^[0-9a-f-]{36}$/i.test(admissionId)) {
    return { ok: false, status: 400, error: "Invalid admission." };
  }
  if (typeof contentType !== "string" || !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    return { ok: false, status: 400, error: "Only WebP, JPEG or PNG images are allowed." };
  }
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: `Photos must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  }
  const [row] = await getReadDb()
    .select({ id: schema.admission.id })
    .from(schema.admission)
    .where(and(eq(schema.admission.id, admissionId), eq(schema.admission.status, "active")));
  if (!row) return { ok: false, status: 404, error: "This admission is not active." };
  return { ok: true, staffName: staff.displayName };
}

/** Cheap magic-byte check so a mislabelled file is not stored as an image. */
export function sniffMatches(bytes: Uint8Array, contentType: string): boolean {
  const b = bytes;
  if (contentType === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (contentType === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (contentType === "image/webp") {
    return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  }
  return false;
}
