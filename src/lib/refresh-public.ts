import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { gpxPath } from "./gpx-export";
import { LIST_PATHS, ogImagePath } from "./site";

/**
 * Refreshes everything public about a guide after it was published, unpublished or deleted: its
 * page, its GPX file and card image, and the pages that list hikes.
 *
 * From a route, revalidatePath only marks the pages: the next visitor is still handed the old
 * copy while a fresh one is made. So the route makes that next request itself, and nobody else is
 * served a guide that was just taken down, or the version from before it was published.
 */
export function refreshPublic(slug: string, req: Request) {
  revalidatePath(`/hikes/${slug}`);
  revalidatePath(gpxPath(slug));
  revalidatePath(ogImagePath(slug));
  LIST_PATHS.forEach((p) => revalidatePath(p));
  after(() => Promise.allSettled([`/hikes/${slug}`, ...LIST_PATHS].map((p) => fetch(new URL(p, req.url), { cache: "no-store" }))));
}
