import "server-only";
import { hikes, tracks, waypoints } from "#site/content";
import { deriveWaypoints, routeCoords } from "./hike";

export type HikeDoc = (typeof hikes)[number];

const isVisible = (h: HikeDoc) => process.env.NODE_ENV === "development" || !h.draft;

export function getHikes(): HikeDoc[] {
  return hikes.filter(isVisible).sort((a, b) => b.date.localeCompare(a.date));
}

export function getHike(slug: string): HikeDoc | undefined {
  return getHikes().find((h) => h.slug === slug);
}

export function getTrack(slug: string) {
  return tracks.find((t) => t.hike === slug) ?? null;
}

export function getWaypoints(slug: string) {
  return deriveWaypoints(waypoints.find((w) => w.hike === slug)?.waypoints ?? [], getTrack(slug));
}

/** Line drawn on the maps: the recorded GPX track when present, else straight segments. */
export function getRoute(slug: string) {
  return routeCoords(getWaypoints(slug), getTrack(slug));
}

/** Lightweight shape for the gallery (no MDX body). */
export function getHikeSummaries() {
  return getHikes().map(({ body: _body, ...rest }) => rest);
}
export type HikeSummary = ReturnType<typeof getHikeSummaries>[number];
