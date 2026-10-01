import { bearing, distanceMi } from "../../src/lib/geo";
import type { Waypoint } from "../../src/lib/schemas";

/** Photos closer than this are treated as the same spot when inferring a heading. */
const SAME_SPOT_MI = 0.005; // ~8 m

export const round = (n: number, dp = 6) => Math.round(n * 10 ** dp) / 10 ** dp;

/** "IMG_3101.JPG" → "img-3101" */
export const kebab = (s: string) =>
  s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Located = { lat: number; lng: number; heading: number | null };

/** EXIF heading → bearing to the next photo taken somewhere else ("inferred") → null (set by hand). */
export function inferHeadings(photos: Located[]): Pick<Waypoint, "heading" | "headingSource">[] {
  return photos.map((p, i) => {
    if (p.heading !== null) return { heading: round(p.heading, 1), headingSource: "exif" };
    const next = photos.slice(i + 1).find((q) => distanceMi(p, q) > SAME_SPOT_MI);
    if (next) return { heading: round(bearing(p, next), 1), headingSource: "inferred" };
    return { heading: null, headingSource: null };
  });
}
