import { NextResponse } from "next/server";
import { uploadMode } from "@/lib/env";
import { newObjectKey, putObject } from "@/lib/storage";
import { guardUpload } from "../guard";
import { MAX_UPLOAD_BYTES, sniffImageType } from "../image-rules";

export const dynamic = "force-dynamic";

/**
 * Fallback for providers where browser PUTs to the bucket are not possible (no CORS).
 * Enabled with S3_UPLOAD_MODE=proxy. The browser POSTs the already-compressed image here and the
 * server stores it. Same auth, role, type and size checks as the presigned flow.
 */
export async function POST(request: Request) {
  if (uploadMode() !== "proxy") {
    return NextResponse.json({ error: "Proxy uploads are disabled." }, { status: 400 });
  }
  // Cheap early rejection before buffering the body.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Photo is too large." }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const admissionId = form?.get("admissionId");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });

  const guard = await guardUpload(admissionId, file.type, file.size);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (sniffImageType(bytes) !== file.type) {
    return NextResponse.json({ error: "That file is not a valid image." }, { status: 400 });
  }
  const key = newObjectKey(admissionId as string, file.type);
  try {
    await putObject(key, bytes, file.type);
    return NextResponse.json({ key });
  } catch (e) {
    console.error("proxy upload failed", e);
    return NextResponse.json({ error: "Photo storage is not configured or unreachable." }, { status: 503 });
  }
}
