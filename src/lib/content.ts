import "server-only";
import { hikes, waypoints } from "#site/content";
import { deriveWaypoints } from "./hike";

export type HikeDoc = (typeof hikes)[number];

const isVisible = (h: HikeDoc) => process.env.NODE_ENV === "development" || !h.draft;

export function getHikes(): HikeDoc[] {
  return hikes.filter(isVisible).sort((a, b) => b.date.localeCompare(a.date));
}

export function getHike(slug: string): HikeDoc | undefined {
  return getHikes().find((h) => h.slug === slug);
}

export function getWaypoints(slug: string) {
  return deriveWaypoints(waypoints.find((w) => w.hike === slug)?.waypoints ?? []);
}

/** Lightweight shape for the gallery (no MDX body). */
export function getHikeSummaries() {
  return getHikes().map(({ body: _body, ...rest }) => rest);
}
export type HikeSummary = ReturnType<typeof getHikeSummaries>[number];
