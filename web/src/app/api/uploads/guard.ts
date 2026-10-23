import "server-only";
import { and, eq } from "drizzle-orm";
import { getReadDb, schema } from "@/db";
import { can } from "@/lib/permissions";
import { getStaff } from "@/lib/session";
import { checkUploadMeta } from "./image-rules";

export type Guard = { ok: true; staffName: string } | { ok: false; status: number; error: string };

/** Auth + role + admission + type + size checks shared by the presign and proxy upload routes. */
export async function guardUpload(admissionId: unknown, contentType: unknown, size: unknown): Promise<Guard> {
  const staff = await getStaff();
  if (!staff) return { ok: false, status: 401, error: "Sign in again." };
  if (staff.mustChangePassword) return { ok: false, status: 403, error: "Set your own password first." };
  if (!can(staff.role, "media.attach")) return { ok: false, status: 403, error: "Your role cannot attach photos." };
  if (typeof admissionId !== "string" || !/^[0-9a-f-]{36}$/i.test(admissionId)) {
    return { ok: false, status: 400, error: "Invalid admission." };
  }
  const rejected = checkUploadMeta(contentType, size);
  if (rejected) return { ok: false, ...rejected };
  const [row] = await getReadDb()
    .select({ id: schema.admission.id })
    .from(schema.admission)
    .where(and(eq(schema.admission.id, admissionId), eq(schema.admission.status, "active")));
  if (!row) return { ok: false, status: 404, error: "This admission is not active." };
  return { ok: true, staffName: staff.displayName };
}

