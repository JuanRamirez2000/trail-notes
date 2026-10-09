import { bearing, distanceMi } from "./geo";
import type { Track, Waypoint } from "./schemas";
import type { PhotoVariant } from "./storage";
import { locateAllOnTrack, locateOnTrack, trackLine, type TrackPosition } from "./track";

/**
 * The rules for turning photos into pins, shared by `pnpm ingest` (Node, sharp) and the editor's
 * photo upload (the browser, a canvas), so the two can't drift. Nothing here touches files, the
 * DOM or an image library: each side reads the EXIF with exifr and the pixel size its own way and
 * passes them in.
 */

/** What to ask exifr for: GPS, the capture time, and the XMP that marks a 360° photo. */
export const EXIF_OPTIONS = { gps: true, xmp: true, tiff: true, exif: true };

/** Longest edge of each stored variant, in pixels. A pano is sized by its width. */
export const PHOTO_SIZES: Record<PhotoVariant, { flat: number; pano: number }> = {
  full: { flat: 2400, pano: 6144 },
  thumb: { flat: 480, pano: 960 },
};
export const WEBP_QUALITY: Record<PhotoVariant, number> = { full: 82, thumb: 74 };

export type PhotoMeta = {
  /** Null when the photo has no GPS position. */
  lat: number | null;
  lng: number | null;
  /** Capture time in ms. Used to order a batch and never stored: timestamps stay private. */
  takenAt: number | null;
  heading: number | null;
  isPano: boolean;
};

/** A photo with its file name and its size as a viewer sees it (after EXIF rotation). */
export type ScannedPhoto = PhotoMeta & { name: string; width: number; height: number };

/** The facts ingest needs from a photo's EXIF (as parsed by exifr with EXIF_OPTIONS) and its upright size. */
export function readPhotoMeta(exif: unknown, size: { width: number; height: number }): PhotoMeta {
  const meta = (exif && typeof exif === "object" ? exif : {}) as Record<string, unknown>;
  const located = typeof meta.latitude === "number" && typeof meta.longitude === "number";
  const isPano = meta.ProjectionType === "equirectangular" || (size.width > 0 && Math.abs(size.width / size.height - 2) < 0.02);
  // Panos (GPano XMP) store the image-centre heading as PoseHeadingDegrees.
  const rawHeading = isPano ? (meta.PoseHeadingDegrees ?? meta.GPSImgDirection) : meta.GPSImgDirection;
  const taken = meta.DateTimeOriginal ?? meta.CreateDate;
  return {
    lat: located ? (meta.latitude as number) : null,
    lng: located ? (meta.longitude as number) : null,
    takenAt: taken instanceof Date && !Number.isNaN(+taken) ? taken.getTime() : null,
    heading: typeof rawHeading === "number" ? ((rawHeading % 360) + 360) % 360 : null,
    isPano,
  };
}

/** Capture order, with the file name settling ties and photos without a time first. */
export function sortByCapture<T extends { takenAt: number | null; name: string }>(photos: T[]): T[] {
  return [...photos].sort((a, b) => (a.takenAt ?? 0) - (b.takenAt ?? 0) || a.name.localeCompare(b.name));
}

/** The pixel size of a stored variant: scaled down to fit PHOTO_SIZES, never up. */
export function variantSize(size: { width: number; height: number }, isPano: boolean, variant: PhotoVariant): { width: number; height: number } {
  const max = PHOTO_SIZES[variant][isPano ? "pano" : "flat"];
  const scale = Math.min(1, max / (isPano ? size.width : Math.max(size.width, size.height)));
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
}

/** Photos closer than this are treated as the same spot when inferring a heading. */
const SAME_SPOT_MI = 0.005; // ~8 m

export const round = (n: number, dp = 6) => Math.round(n * 10 ** dp) / 10 ** dp;

/** "IMG_3101.JPG" → "img-3101" */
export const kebab = (s: string) =>
  s.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Storage key of a hike's NNth photo: `<slug>/<NN>-<name>`. */
export const photoKey = (slug: string, n: number, fileName: string) => `${slug}/${String(n).padStart(2, "0")}-${kebab(fileName)}`;

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

export type PinPhoto = Pick<ScannedPhoto, "isPano" | "width" | "height"> & {
  /** Where the photo was stored. Its number names the pin: `<slug>/07-…` becomes `wp-07`. */
  key: string;
  lat: number;
  lng: number;
} & Pick<Waypoint, "heading" | "headingSource">;

/**
 * One pin per photo, in the order given. `width` and `height` are the stored full-size image's.
 * The first photo of a hike with no pins is its trailhead; the rest are turns for the author to
 * retype and retitle. `order` is left for mergeWaypoints. An id already in `usedIds` gets a suffix.
 */
export function pinsFromPhotos(photos: PinPhoto[], { isNewHike, usedIds = [] }: { isNewHike: boolean; usedIds?: Iterable<string> }): Waypoint[] {
  const used = new Set(usedIds);
  return photos.map((p, i) => {
    const n = /\/(\d+)-/.exec(p.key)?.[1] ?? String(i + 1).padStart(2, "0");
    let id = `wp-${n}`;
    for (let k = 2; used.has(id); k++) id = `wp-${n}-${k}`;
    used.add(id);
    const label = isNewHike && i === 0 ? "Trailhead" : `Photo ${n}`;
    return {
      id,
      order: 0,
      type: label === "Trailhead" ? "start" : "turn",
      label,
      // A placeholder that reads as one: it's the heading of the pin's section until it's written.
      title: label,
      lat: round(p.lat),
      lng: round(p.lng),
      heading: p.heading,
      headingSource: p.headingSource,
      photo: { key: p.key, kind: p.isPano ? "pano" : "flat", width: p.width, height: p.height },
    };
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
