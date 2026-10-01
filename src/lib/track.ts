import { cumulativeMiles, distanceMi } from "./geo";
import type { LngLat, Track } from "./schemas";

type Pt = Pick<LngLat, "lat" | "lng">;

/** Within this of the closest match, take the earliest segment (so out-and-back legs resolve outbound first). */
const SNAP_SLACK_MI = 0.01;

/** A recorded track prepared for point lookups. `miles[i]` is the trail mileage at vertex i. */
export type TrackLine = { pts: Pt[]; miles: number[] };

/** Where a point lands on the track: segment `index` → `index + 1`, fraction `t` along it. */
export type TrackPosition = { index: number; t: number; lat: number; lng: number; mile: number; offMi: number };

export function trackLine({ points, distanceMi: totalMi }: Pick<Track, "points" | "distanceMi">): TrackLine {
  const pts = points.map(([lng, lat]) => ({ lat, lng }));
  // The stored line is simplified and so slightly shorter than the recording; rescale to the
  // full-resolution distance so mileages match the hike's stats.
  const raw = cumulativeMiles(pts);
  const scale = totalMi / (raw.at(-1) || 1);
  return { pts, miles: raw.map((m) => m * scale) };
}

/** Closest point on segment a→b, in a local planar approximation (fine at trail scale). */
function project(p: Pt, a: Pt, b: Pt) {
  const k = Math.cos((a.lat * Math.PI) / 180);
  const [ax, ay, bx, by, px, py] = [a.lng * k, a.lat, b.lng * k, b.lat, p.lng * k, p.lat];
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = len2 ? Math.min(1, Math.max(0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2)) : 0;
  const at = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  return { t, at, d: distanceMi(p, at) };
}

/**
 * Locates `p` on the track, searching only forward from `after` (the previous point's position).
 * Feeding points in route order makes a spot passed twice resolve to the right leg: the outbound
 * one if it comes before the turnaround, the return one after it.
 */
export function locateOnTrack(line: TrackLine, p: Pt, after?: Pick<TrackPosition, "index" | "t">): TrackPosition {
  const { pts, miles } = line;
  const from = after?.index ?? 0;
  const hits = [];
  for (let i = from; i < pts.length - 1; i++) {
    const hit = project(p, pts[i], pts[i + 1]);
    // Never step backwards within the segment we're resuming from.
    if (i === from && after && hit.t < after.t) {
      const t = after.t;
      const at = { lat: pts[i].lat + (pts[i + 1].lat - pts[i].lat) * t, lng: pts[i].lng + (pts[i + 1].lng - pts[i].lng) * t };
      hits.push({ i, t, at, d: distanceMi(p, at) });
    } else {
      hits.push({ i, ...hit });
    }
  }
  if (!hits.length) return { index: 0, t: 0, ...pts[0], mile: 0, offMi: distanceMi(p, pts[0]) };
  const best = Math.min(...hits.map((h) => h.d));
  const { i, t, at, d } = hits.find((h) => h.d <= best + SNAP_SLACK_MI)!;
  return { index: i, t, lat: at.lat, lng: at.lng, mile: miles[i] + (miles[i + 1] - miles[i]) * t, offMi: d };
}

/** Locates points given in route order, each searching forward from the one before. */
export function locateAllOnTrack(line: TrackLine, points: Pt[]): TrackPosition[] {
  let prev: TrackPosition | undefined;
  return points.map((p) => (prev = locateOnTrack(line, p, prev)));
}
