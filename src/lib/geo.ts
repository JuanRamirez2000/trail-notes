import turfBbox from "@turf/bbox";
import turfBearing from "@turf/bearing";
import turfDistance from "@turf/distance";
import { featureCollection, point } from "@turf/helpers";
import type { LngLat } from "./schemas";

type Pt = Pick<LngLat, "lat" | "lng">;

const toPoint = (p: Pt) => point([p.lng, p.lat]);

/** Initial compass bearing from a to b, normalised to [0, 360). */
export function bearing(a: Pt, b: Pt): number {
  return (turfBearing(toPoint(a), toPoint(b)) + 360) % 360;
}

export function distanceMi(a: Pt, b: Pt): number {
  return turfDistance(toPoint(a), toPoint(b), { units: "miles" });
}

/**
 * Cumulative straight-line mileage along ordered points. Underestimates real
 * trail distance (no GPX in phase 1), which is why waypoints allow a `mile` override.
 */
export function cumulativeMiles(points: Pt[]): number[] {
  let total = 0;
  return points.map((p, i) => {
    if (i > 0) total += distanceMi(points[i - 1], p);
    return total;
  });
}

/** [[west, south], [east, north]] — the shape Mapbox fitBounds wants. */
export function bounds(points: Pt[]): [[number, number], [number, number]] {
  const [w, s, e, n] = turfBbox(featureCollection(points.map(toPoint)));
  return [
    [w, s],
    [e, n],
  ];
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function compassLabel(heading: number): string {
  return COMPASS[Math.round(normalizeHeading(heading) / 45) % 8];
}

export function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function directionsUrl({ lat, lng }: Pt): string {
  // Universal Maps URL: opens Google Maps app/web, and Apple Maps users get a handoff prompt.
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
