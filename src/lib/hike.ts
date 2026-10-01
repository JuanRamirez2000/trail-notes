import { cumulativeMiles, distanceMi } from "./geo";
import { isSafetyType, requiresSection } from "./pins";
import type { Track, Waypoint } from "./schemas";

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

/** Water, bail-outs and ranger stations: the pins that make up the Safety points layer. */
/** Within this of the closest match, take the earliest vertex (so out-and-back legs resolve outbound first). */
const SNAP_SLACK_MI = 0.01;

/**
 * Trail mileage for each waypoint by snapping it onto the recorded track. The search only moves
 * forward from the previous waypoint's match, so on an out-and-back a waypoint passed twice gets
 * the outbound mileage if it's ordered before the turnaround and the return mileage after it.
 */
function milesAlongTrack(waypoints: Waypoint[], { points, distanceMi: totalMi }: Pick<Track, "points" | "distanceMi">): number[] {
  const pts = points.map(([lng, lat]) => ({ lat, lng }));
  // The stored line is simplified and so slightly shorter than the recording; rescale to the
  // full-resolution distance so mileages match the hike's stats.
  const raw = cumulativeMiles(pts);
  const scale = totalMi / (raw.at(-1) || 1);
  const cum = raw.map((m) => m * scale);
  let from = 0;
  return waypoints.map((wp) => {
    const dists = pts.slice(from).map((p) => distanceMi(wp, p));
    const best = Math.min(...dists);
    const i = from + dists.findIndex((d) => d <= best + SNAP_SLACK_MI);
    from = i;
    return cum[i];
  });
}

export function routeCoords(waypoints: Pick<Waypoint, "lat" | "lng">[], track?: Pick<Track, "points"> | null): RouteCoords {
  return track ? track.points.map(([lng, lat]) => [lng, lat]) : waypoints.map((w) => [w.lng, w.lat]);
}

export const isSafety = (wp: Pick<Waypoint, "type">) => isSafetyType(wp.type);

/** DOM id of a waypoint's guide section (used for scroll links and scrollspy). */
export const sectionId = (waypointId: string) => `step-${waypointId}`;
