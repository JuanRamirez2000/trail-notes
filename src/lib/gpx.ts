import turfLength from "@turf/length";
import { lineString } from "@turf/helpers";
import turfSimplify from "@turf/simplify";
import { trackSchema } from "./schemas";

const M_TO_FT = 3.28084;
/** Moving-average window for elevation before summing gain; raw GPS altitude is noisy. */
const SMOOTH = 5;

export type RawPoint = [lng: number, lat: number, ele: number];

const NUMBER = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?";

/**
 * Points of a GPX file as [lng, lat, ele]. Track points (`<trkpt>`) if the file has any, else the
 * points of a planned route (`<rtept>`). Points without a usable position are skipped.
 */
export function parseGpx(xml: string): RawPoint[] {
  // GPX is simple enough that a targeted regex beats pulling in an XML parser. Attribute order
  // isn't fixed (some apps write lon first), tags may carry a namespace prefix (`<gpx:trkpt>`)
  // and a point may be self-closing with no <ele>.
  const attr = (attrs: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']\\s*(${NUMBER})\\s*["']`).exec(attrs)?.[1];
  const read = (tag: string) => {
    const out: RawPoint[] = [];
    const re = new RegExp(`<(?:\\w+:)?${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${tag}>)`, "g");
    for (const m of xml.matchAll(re)) {
      const lat = Number(attr(m[1], "lat"));
      const lon = Number(attr(m[1], "lon"));
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      const ele = new RegExp(`<(?:\\w+:)?ele>\\s*(${NUMBER})\\s*</(?:\\w+:)?ele>`).exec(m[2] ?? "");
      out.push([lon, lat, ele ? Number(ele[1]) : NaN]);
    }
    return out;
  };
  const track = read("trkpt");
  return track.length ? track : read("rtept");
}

/** Elevations with the gaps filled from the nearest point that has one (0 if none does). */
export function fillElevations(eles: number[]): number[] {
  const out = [...eles];
  let last = NaN;
  for (let i = 0; i < out.length; i++) {
    if (Number.isFinite(out[i])) last = out[i];
    else out[i] = last;
  }
  let next = NaN;
  for (let i = out.length - 1; i >= 0; i--) {
    if (Number.isFinite(out[i])) next = out[i];
    else out[i] = Number.isFinite(next) ? next : 0;
  }
  return out;
}

export function elevationStats(eles: number[]) {
  const valid = eles.filter((e) => Number.isFinite(e));
  if (!valid.length) return { gainFt: 0, maxFt: 0, minFt: 0 };
  const smooth = valid.map((_, i) => {
    const w = valid.slice(Math.max(0, i - SMOOTH), i + SMOOTH + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  let gain = 0;
  for (let i = 1; i < smooth.length; i++) gain += Math.max(0, smooth[i] - smooth[i - 1]);
  // Not Math.max(...valid): spreading a day-long recording overflows the call stack.
  let max = -Infinity;
  let min = Infinity;
  for (const e of valid) {
    if (e > max) max = e;
    if (e < min) min = e;
  }
  return { gainFt: gain * M_TO_FT, maxFt: max * M_TO_FT, minFt: min * M_TO_FT };
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * Raw recording → track.json shape. Distance and gain come from the full-resolution points;
 * only the stored line is simplified (Douglas-Peucker), so the stats stay accurate.
 */
export function buildTrack(raw: RawPoint[], tolerance = 0.00003) {
  if (raw.length < 2) throw new Error("No track points (<trkpt> or <rtept>) found in the GPX file.");
  const distanceMi = turfLength(lineString(raw.map(([lng, lat]) => [lng, lat])), { units: "miles" });
  const { gainFt, maxFt, minFt } = elevationStats(raw.map((p) => p[2]));

  // Simplify on [lng, lat, ele]; turf keeps the 3rd coordinate on retained vertices. A point
  // recorded without an elevation takes its neighbour's, not 0 (a pit in the middle of a climb).
  const eles = fillElevations(raw.map((p) => p[2]));
  const simplified = turfSimplify(lineString(raw.map(([lng, lat], i) => [lng, lat, eles[i]])), {
    tolerance,
    highQuality: true,
  });
  const points = simplified.geometry.coordinates.map(([lng, lat, ele]) => [round(lng, 6), round(lat, 6), round(ele ?? 0, 1)] as RawPoint);

  return trackSchema.safeParse({
    points,
    // A recording too short to round to anything still has a distance.
    distanceMi: Math.max(round(distanceMi, 2), 0.01),
    elevationGainFt: Math.round(gainFt),
    maxElevationFt: Math.round(maxFt),
    minElevationFt: Math.round(minFt),
  });
}
