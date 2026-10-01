import { cumulativeMiles } from "./geo";
import { requiresSection } from "./pins";
import type { Waypoint } from "./schemas";

/** Waypoint enriched with values derived from its neighbours. Safe to send to the client. */
export type HikeWaypoint = Waypoint & {
  /** Trail mileage: authored `mile` if present, else straight-line estimate. */
  mile: number;
  /** 0-based position among required-section waypoints (the numbered steps), or null. */
  stepIndex: number | null;
};

export function deriveWaypoints(waypoints: Waypoint[]): HikeWaypoint[] {
  const ordered = [...waypoints].sort((a, b) => a.order - b.order);
  const estimated = cumulativeMiles(ordered);
  let step = 0;
  return ordered.map((wp, i) => ({
    ...wp,
    mile: wp.mile ?? estimated[i],
    stepIndex: requiresSection(wp.type) ? step++ : null,
  }));
}

export const isSafety = (wp: Pick<Waypoint, "type">) => wp.type === "water" || wp.type === "bailout";

/** DOM id of a waypoint's guide section (used for scroll links and scrollspy). */
export const sectionId = (waypointId: string) => `step-${waypointId}`;
