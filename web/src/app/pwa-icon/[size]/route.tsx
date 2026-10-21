import { renderAppIcon } from "@/lib/app-icon";

const SIZES = [192, 512];

export function generateStaticParams() {
  return SIZES.map((s) => ({ size: String(s) }));
}

/** PNG icons referenced by the web app manifest (Android home screen and splash). */
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const size = Number((await ctx.params).size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  return renderAppIcon(size);
}
