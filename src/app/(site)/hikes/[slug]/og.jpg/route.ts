import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getHikePage, getHikeSummaries } from "@/lib/content";
import { OG_SIZE } from "@/lib/site";
import { photoUrl } from "@/lib/storage";

// Cached like the guide's page: made at build or on first request, refreshed on publish and hourly.
export async function generateStaticParams() {
  return (await getHikeSummaries()).filter((h) => h.cover).map((h) => ({ slug: h.slug }));
}
export const revalidate = 3600;

/**
 * The guide's cover as a social card image: a 1200 × 630 JPEG. Photos are stored as 2400 px webp,
 * which some link previews can't show and all of them have to shrink. `next/og` can only make
 * PNGs (several times the size for a photo), so this is sharp, which Next already ships.
 */
export async function GET(_req: Request, ctx: RouteContext<"/hikes/[slug]/og.jpg">) {
  const { slug } = await ctx.params;
  const cover = (await getHikePage(slug))?.hike.cover;
  if (!cover) return new Response("Not found", { status: 404 });

  const url = photoUrl(cover);
  // The dev-only local photo backend gives a path under public/, not an address.
  const source = url.startsWith("/") ? await readFile(path.join(process.cwd(), "public", url)).catch(() => null) : await fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null));
  if (!source) return new Response("Not found", { status: 404 });

  const jpeg = await sharp(source).resize(OG_SIZE.width, OG_SIZE.height, { fit: "cover" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { "content-type": "image/jpeg" } });
}
