import { inferHeadings, mergeWaypoints, pinsFromPhotos, sortByCapture, type MergeResult, type ScannedPhoto } from "@/lib/ingest";
import type { Photo, Track, Waypoint } from "@/lib/schemas";
import { addPin, updatePin } from "./pin-ops";

/** A photo that has been uploaded: where it is, what was read from the file, and the stored image's size. */
export type UploadedPhoto = { key: string; meta: ScannedPhoto; width: number; height: number };

export type PhotoPinsResult = {
  json: string;
  /** Photo key → the id of the pin made for it. */
  pinned: Map<string, string>;
  /** Photos with no GPS position: uploaded, but on no pin until the author places them. */
  unplaced: string[];
  offTrack: MergeResult["offTrack"];
};

/**
 * Turns a batch of uploaded photos into pins, the way `pnpm ingest` does: in capture order, each
 * at its GPS position with its direction from EXIF or guessed from the next photo, snapped onto
 * the recorded track and slotted in by trail mileage. Existing pins keep their fields as written.
 */
export function addPhotoPins(json: string, uploaded: UploadedPhoto[], track: Pick<Track, "points" | "distanceMi"> | null): PhotoPinsResult {
  const file = JSON.parse(json) as { waypoints?: Waypoint[] };
  const existing = file.waypoints ?? [];
  const sorted = sortByCapture(uploaded.map((u) => ({ ...u, name: u.meta.name, takenAt: u.meta.takenAt })));
  const located = sorted.flatMap((u) => (u.meta.lat === null || u.meta.lng === null ? [] : [{ ...u, lat: u.meta.lat, lng: u.meta.lng, heading: u.meta.heading }]));
  const unplaced = sorted.filter((u) => u.meta.lat === null || u.meta.lng === null).map((u) => u.key);
  if (!located.length) return { json, pinned: new Map(), unplaced, offTrack: [] };

  const headings = inferHeadings(located);
  const incoming = pinsFromPhotos(
    located.map((u, i) => ({ key: u.key, lat: u.lat, lng: u.lng, ...headings[i], isPano: u.meta.isPano, width: u.width, height: u.height })),
    { isNewHike: existing.length === 0, usedIds: existing.map((w) => w.id) },
  );
  const { waypoints, offTrack } = mergeWaypoints(existing, incoming, track);
  return {
    json: `${JSON.stringify({ ...file, waypoints }, null, 2)}\n`,
    pinned: new Map(incoming.map((w, i) => [located[i].key, w.id])),
    unplaced,
    offTrack,
  };
}

/** The label a photo's pin gets: "Photo 07" for `<slug>/07-img-3101`. */
export const photoLabel = (key: string) => `Photo ${/\/(\d+)-/.exec(key)?.[1] ?? ""}`.trim();

/** A new pin for an unplaced photo, where the author put it on the map. */
export function placePhoto(json: string, photo: Photo, at: { lat: number; lng: number }, track: Pick<Track, "points" | "distanceMi"> | null): { json: string; id: string } {
  const added = addPin(json, at, track, "turn");
  const label = photoLabel(photo.key);
  return { json: updatePin(added.json, added.id, { photo, label, title: label }), id: added.id };
}
