import { cumulativeMiles } from "./geo";
import { isSafetyType, requiresSection } from "./pins";
import type { Track, Waypoint } from "./schemas";
import { locateAllOnTrack, trackLine } from "./track";

/** Waypoint enriched with values derived from its neighbours. Safe to send to the client. */
export type HikeWaypoint = Waypoint & {
  /** Trail mileage: authored `mile` if present, else straight-line estimate. */
  mile: number;
  /** 0-based position among required-section waypoints (the numbered steps), or null. */
  stepIndex: number | null;
};

/** Route line as [lng, lat] pairs: the recorded track if there is one, else waypoint to waypoint. */
export type RouteCoords = [number, number][];

export function deriveWaypoints(waypoints: Waypoint[], track?: Pick<Track, "points" | "distanceMi"> | null): HikeWaypoint[] {
  const ordered = [...waypoints].sort((a, b) => a.order - b.order);
  const estimated = track ? milesAlongTrack(ordered, track) : cumulativeMiles(ordered);
  let step = 0;
  return ordered.map((wp, i) => ({
    ...wp,
    mile: wp.mile ?? estimated[i],
    stepIndex: requiresSection(wp.type) ? step++ : null,
  }));
}

/**
 * Trail mileage for each waypoint, measured along the recorded track. Waypoints are located in
 * route order, each searching forward from the previous one, so on an out-and-back a spot passed
 * twice gets the outbound mileage before the turnaround and the return mileage after it.
 */
function milesAlongTrack(waypoints: Waypoint[], track: Pick<Track, "points" | "distanceMi">): number[] {
  return locateAllOnTrack(trackLine(track), waypoints).map((p) => p.mile);
}

export function routeCoords(waypoints: Pick<Waypoint, "lat" | "lng">[], track?: Pick<Track, "points"> | null): RouteCoords {
  return track ? track.points.map(([lng, lat]) => [lng, lat]) : waypoints.map((w) => [w.lng, w.lat]);
}

/** Water, bail-outs and ranger stations: the pins that make up the Safety points layer. */
export const isSafety = (wp: Pick<Waypoint, "type">) => isSafetyType(wp.type);

/** DOM id of a waypoint's guide section (used for scroll links and scrollspy). */
export const sectionId = (waypointId: string) => `step-${waypointId}`;
