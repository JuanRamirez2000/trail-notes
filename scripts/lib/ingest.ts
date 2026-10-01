import { bearing, distanceMi } from "../../src/lib/geo";
import type { Track, Waypoint } from "../../src/lib/schemas";
import { locateAllOnTrack, locateOnTrack, trackLine, type TrackPosition } from "../../src/lib/track";

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

/** Photos further than this from the recorded track keep their own GPS position (and are reported). */
export const SNAP_MAX_MI = 0.05; // ~80 m

export type MergeResult = {
  waypoints: Waypoint[];
  /**
   * New waypoints left where their GPS put them because they're far from the track at the point
   * their capture time puts them. `nearestMi` is the distance to the track anywhere: when that's
   * small, the photo is probably out of order (camera clock, edited timestamp) rather than off-trail.
   */
  offTrack: { id: string; offMi: number; nearestMi: number }[];
};

/**
 * Merges newly ingested waypoints (in capture-time order) into a hike's existing ones.
 *
 * With a recorded track, both lists are located along it (each in its own route order, so
 * out-and-back legs resolve correctly), new photos near the track are snapped onto it, and the
 * two lists are interleaved by trail mileage. Without a track, new waypoints go after the
 * existing ones. Either way `order` is renumbered in steps of 10; ids and text are untouched.
 */
export function mergeWaypoints(
  existing: Waypoint[],
  incoming: Waypoint[],
  track?: Pick<Track, "points" | "distanceMi"> | null,
): MergeResult {
  const old = [...existing].sort((a, b) => a.order - b.order);
  const renumber = (list: Waypoint[]) => list.map((w, i) => ({ ...w, order: (i + 1) * 10 }));
  if (!track) return { waypoints: renumber([...old, ...incoming]), offTrack: [] };

  const line = trackLine(track);
  const oldPos = locateAllOnTrack(line, old);
  // Locate new photos in capture order, but don't let a side-trip photo (far from the track)
  // drag the forward search along with it, and report its distance to the nearest point anywhere.
  const offTrack: MergeResult["offTrack"] = [];
  let cursor: TrackPosition | undefined;
  const newPos = incoming.map((w) => {
    const p = locateOnTrack(line, w, cursor);
    if (p.offMi <= SNAP_MAX_MI) cursor = p;
    else offTrack.push({ id: w.id, offMi: round(p.offMi, 3), nearestMi: round(locateOnTrack(line, w).offMi, 3) });
    return p;
  });
  const snapped = incoming.map((w, i) => (newPos[i].offMi > SNAP_MAX_MI ? w : { ...w, lat: round(newPos[i].lat), lng: round(newPos[i].lng) }));

  // Both lists are already in route order, so a stable two-way merge by mileage keeps each intact.
  const merged: Waypoint[] = [];
  let i = 0;
  let j = 0;
  while (i < old.length || j < snapped.length) {
    if (j >= snapped.length || (i < old.length && oldPos[i].mile <= newPos[j].mile)) merged.push(old[i++]);
    else merged.push(snapped[j++]);
  }
  return { waypoints: renumber(merged), offTrack };
}

/**
 * Next free numbers for a hike that already has waypoints: photo keys are `<slug>/<NN>-<name>`
 * and ingest ids are `wp-<NN>`. Also returns the photo names already ingested, so re-running
 * ingest on the same folder skips them.
 */
export function existingNumbering(existing: Waypoint[]) {
  const nums = existing.flatMap((w) => [
    Number(/^wp-(\d+)$/.exec(w.id)?.[1] ?? 0),
    Number(/\/(\d+)-/.exec(w.photo?.key ?? "")?.[1] ?? 0),
  ]);
  const names = new Set(existing.flatMap((w) => (w.photo ? [w.photo.key.replace(/^.*\/(\d+-)?/, "")] : [])));
  return { next: Math.max(0, ...nums) + 1, names };
}
