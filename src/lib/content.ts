import "server-only";
import { cache } from "react";
import { deriveWaypoints, routeCoords, type HikeWaypoint, type RouteCoords } from "./hike";
import { compileGuide } from "./mdx/compile";
import { SLUG, waypointsFileSchema, type Frontmatter, type Track } from "./schemas";
import { getStore } from "./store/server";
import type { HikeStatus } from "./store/types";

/**
 * What the public pages read. Everything comes through the content store (files or database), and
 * the guide's MDX is compiled here, on the server, when a page is rendered; the rendered page is
 * what gets cached (see the route's `revalidate` and the editor's save route).
 */

/** Lightweight shape for the gallery: the guide's validated details. */
export type HikeSummary = Frontmatter;

/** Drafts show under `pnpm dev` only. */
const isVisible = (status: HikeStatus) => process.env.NODE_ENV === "development" || status === "published";

export const getHikeSummaries = cache(async (): Promise<HikeSummary[]> => {
  const hikes = await (await getStore()).list();
  return hikes
    .filter((h): h is typeof h & { details: Frontmatter } => h.details !== null && isVisible(h.status))
    .map((h) => h.details)
    .sort((a, b) => b.date.localeCompare(a.date));
});

export type HikePage = {
  hike: Frontmatter;
  /** Compiled MDX (a function body) for components/mdx/MDXContent. */
  body: string;
  waypoints: HikeWaypoint[];
  /** Line drawn on the maps: the recorded track when present, else straight segments. */
  route: RouteCoords;
  track: Track | null;
};

/** Everything a guide page needs, or null if there's no such (visible) hike. */
export const getHikePage = cache(async (slug: string): Promise<HikePage | null> => {
  if (!SLUG.test(slug)) return null;
  const record = await (await getStore()).read(slug);
  if (!record || !isVisible(record.status)) return null;
  const summary = (await getHikeSummaries()).find((h) => h.slug === slug);
  if (!summary) return null; // stored but currently invalid (hand-edited files): nothing to show
  const pins = waypointsFileSchema.parse(JSON.parse(record.waypoints)).waypoints;
  const waypoints = deriveWaypoints(pins, record.track);
  return {
    hike: summary,
    body: await compileGuide(record.mdx, pins),
    waypoints,
    route: routeCoords(waypoints, record.track),
    track: record.track,
  };
});
