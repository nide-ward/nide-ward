import { NextResponse } from "next/server";
import { uploadMode } from "@/lib/env";
import { newObjectKey, presignPut } from "@/lib/storage";
import { guardUpload } from "../guard";

export const dynamic = "force-dynamic";

/** Issues a short-lived presigned PUT after auth, role, type and size checks. Presigned mode only. */
export async function POST(request: Request) {
  if (uploadMode() !== "presigned") {
    return NextResponse.json({ error: "Direct uploads are disabled. Use the proxy upload route." }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as { admissionId?: unknown; contentType?: unknown; size?: unknown } | null;
  const guard = await guardUpload(body?.admissionId, body?.contentType, body?.size);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admissionId = body!.admissionId as string;
  const contentType = body!.contentType as string;
  const size = body!.size as number;
  const key = newObjectKey(admissionId, contentType);
  try {
    const url = await presignPut(key, contentType, size);
    return NextResponse.json({ url, key, headers: { "Content-Type": contentType } });
  } catch (e) {
    console.error("presign failed", e);
    return NextResponse.json({ error: "Photo storage is not configured." }, { status: 503 });
  }
}
