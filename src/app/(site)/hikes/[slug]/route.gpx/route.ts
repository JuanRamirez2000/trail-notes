import { getHikePage, getHikeSummaries } from "@/lib/content";
import { toGpx } from "@/lib/gpx-export";
import { SITE_URL } from "@/lib/site";

// Made with the guide's page and cached like it: at build for published guides, on first request
// for one published since, refreshed on publish (the editor's publish route) and hourly.
export async function generateStaticParams() {
  return (await getHikeSummaries()).map((h) => ({ slug: h.slug }));
}
export const revalidate = 3600;

/** The guide's route and pins as a GPX file. A guide that isn't public has none. */
export async function GET(_req: Request, ctx: RouteContext<"/hikes/[slug]/route.gpx">) {
  const { slug } = await ctx.params;
  const page = await getHikePage(slug);
  if (!page) return new Response("Not found", { status: 404 });
  const gpx = toGpx({ title: page.hike.title, summary: page.hike.summary, url: `${SITE_URL}/hikes/${slug}`, track: page.track, waypoints: page.waypoints });
  return new Response(gpx, {
    headers: { "content-type": "application/gpx+xml; charset=utf-8", "content-disposition": `attachment; filename="${slug}.gpx"` },
  });
}

