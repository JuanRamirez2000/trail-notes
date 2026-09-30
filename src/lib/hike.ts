import { cumulativeMiles } from "./geo";
import type { Waypoint } from "./schemas";

/** Waypoint enriched with values derived from its neighbours. Safe to send to the client. */
export type HikeWaypoint = Waypoint & {
  /** Trail mileage: authored `mile` if present, else straight-line estimate. */
  mile: number;
  /** 0-based index among step waypoints, or null if not a step. */
  stepIndex: number | null;
};

export function deriveWaypoints(waypoints: Waypoint[]): HikeWaypoint[] {
  const ordered = [...waypoints].sort((a, b) => a.order - b.order);
  const estimated = cumulativeMiles(ordered);
  let step = 0;
  return ordered.map((wp, i) => ({
    ...wp,
    mile: wp.mile ?? estimated[i],
    stepIndex: wp.step ? step++ : null,
  }));
}

export const isSafety = (wp: Pick<Waypoint, "type">) => wp.type === "water" || wp.type === "bailout";
