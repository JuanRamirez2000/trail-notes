import type { HikeSummary } from "@/lib/content";
import type { Difficulty } from "@/lib/schemas";

export type Range = [number, number];

export type Filters = {
  difficulty: Difficulty[];
  distance: Range;
  elevation: Range;
};

/** Upper slider stop means "and above", so hikes past it still match. */
export const DISTANCE_MAX = 15;
export const ELEVATION_MAX = 5000;

export const EMPTY_FILTERS: Filters = {
  difficulty: [],
  distance: [0, DISTANCE_MAX],
  elevation: [0, ELEVATION_MAX],
};

const inRange = (v: number, [lo, hi]: Range, max: number) => v >= lo && (hi >= max || v <= hi);

export function applyFilters(hikes: HikeSummary[], f: Filters) {
  return hikes.filter(
    (h) =>
      (f.difficulty.length === 0 || f.difficulty.includes(h.difficulty)) &&
      inRange(h.distanceMi, f.distance, DISTANCE_MAX) &&
      inRange(h.elevationGainFt, f.elevation, ELEVATION_MAX),
  );
}

export const isActive = {
  difficulty: (f: Filters) => f.difficulty.length > 0,
  distance: (f: Filters) => f.distance[0] > 0 || f.distance[1] < DISTANCE_MAX,
  elevation: (f: Filters) => f.elevation[0] > 0 || f.elevation[1] < ELEVATION_MAX,
};
