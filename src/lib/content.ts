import "server-only";
import { cache } from "react";
import { elevationProfile, type ProfilePoint } from "./elevation";
import { deriveWaypoints, routeCoords, type HikeWaypoint, type RouteCoords } from "./hike";
import { compileGuide } from "./mdx/compile";
import { SLUG, waypointsFileSchema, type Frontmatter, type Track } from "./schemas";
import { getStore } from "./store/server";

/**
 * What the public pages read. Everything comes through the content store (files or database), and
 * the guide's MDX is compiled here, on the server, when a page is rendered; the rendered page is
 * what gets cached (see the route's `revalidate` and the editor's publish route).
 *
 * The site shows each guide's published copy; drafts and unpublished changes aren't public. Under
 * `pnpm dev` it shows every guide's working copy instead, so an author sees their edits on reload.
 */

/** Lightweight shape for the gallery: the guide's validated details. */
export type HikeSummary = Frontmatter;

const workingCopies = () => process.env.NODE_ENV === "development";

export const getHikeSummaries = cache(async (): Promise<HikeSummary[]> => {
  const hikes = await (await getStore()).list();
  return hikes
    // A hike that was deleted in the editor is gone from every page, `pnpm dev` included.
    .filter((h) => !h.deleteAfter)
    .map((h) => (workingCopies() ? h.details : h.publishedDetails))
    .filter((d): d is Frontmatter => d !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
});

export type HikePage = {
  hike: Frontmatter;
  /** Compiled MDX (a function body) for components/mdx/MDXContent. */
  body: string;
  waypoints: HikeWaypoint[];
  /** Line drawn on the maps: the recorded track when present, else straight segments. */
  route: RouteCoords;
  profile: ProfilePoint[] | null;
  track: Track | null;
};

/** Everything a guide page needs, or null if there's no such (visible) hike. */
export const getHikePage = cache(async (slug: string): Promise<HikePage | null> => {
  if (!SLUG.test(slug)) return null;
  const record = await (await getStore()).read(slug);
  const copy = workingCopies() ? record : record?.published;
  if (!record || !copy || record.deleteAfter) return null;
  const summary = (await getHikeSummaries()).find((h) => h.slug === slug);
  if (!summary) return null; // stored but currently invalid (hand-edited files): nothing to show
  const pins = waypointsFileSchema.parse(JSON.parse(copy.waypoints)).waypoints;
  const waypoints = deriveWaypoints(pins, record.track);
  return {
    hike: summary,
    body: await compileGuide(copy.mdx, pins),
    waypoints,
    route: routeCoords(waypoints, record.track),
    profile: elevationProfile(record.track),
    track: record.track,
  };
});
