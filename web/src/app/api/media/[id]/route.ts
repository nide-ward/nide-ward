import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getReadDb, schema } from "@/db";
import { getStaff } from "@/lib/session";
import { presignGet } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Authenticated view of a lab photo: redirects to a presigned GET that expires in 60 seconds. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return new NextResponse("Unauthorized", { status: 401 });
  if (staff.mustChangePassword) return new NextResponse("Set your own password first.", { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const [row] = await getReadDb().select().from(schema.labMedia).where(eq(schema.labMedia.id, id));
  if (!row) return new NextResponse("Not found", { status: 404 });
  try {
    const url = await presignGet(row.objectKey);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("presign get failed", e);
    return new NextResponse("Photo storage is not configured.", { status: 503 });
  }
}
