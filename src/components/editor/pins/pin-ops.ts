import { bearing } from "@/lib/geo";
import type { Track, WaypointType } from "@/lib/schemas";
import { locateAllOnTrack, locateOnTrack, trackLine } from "@/lib/track";

/**
 * Edits to a guide's pins, as pure functions over the pins JSON text (and, where a change touches
 * the guide, its MDX). The pin editor calls these; nothing here knows about maps or React.
 *
 * They work on the JSON as written, not on a schema-parsed copy, so fields and their order are
 * preserved and nothing is added that the author didn't set. `order` is kept in steps of 10.
 */

type RawPin = Record<string, unknown> & { id: string; order: number; lat: number; lng: number; type: WaypointType };
type PinsFile = { waypoints: RawPin[] };

/** Further than this from the recorded track, a dragged or added pin stays where it was put. */
export const SNAP_MI = 0.05; // ~80 m

const read = (json: string): PinsFile => {
  const data = JSON.parse(json) as PinsFile;
  return { ...data, waypoints: [...(data.waypoints ?? [])].sort((a, b) => a.order - b.order) };
};
const write = (file: PinsFile) => `${JSON.stringify({ ...file, waypoints: file.waypoints.map((w, i) => ({ ...w, order: (i + 1) * 10 })) }, null, 2)}\n`;
const round = (n: number, dp = 6) => Math.round(n * 10 ** dp) / 10 ** dp;

type TrackLike = Pick<Track, "points" | "distanceMi"> | null | undefined;

/** `p` moved onto the track if it's close to it, and whether it was. */
export function snapToTrack(p: { lat: number; lng: number }, track: TrackLike): { lat: number; lng: number; snapped: boolean } {
  if (track) {
    const hit = locateOnTrack(trackLine(track), p);
    if (hit.offMi <= SNAP_MI) return { lat: round(hit.lat), lng: round(hit.lng), snapped: true };
  }
  return { lat: round(p.lat), lng: round(p.lng), snapped: false };
}

/** Sets fields on one pin. `undefined`, `""` or `null` removes an optional field. */
export function updatePin(json: string, id: string, patch: Record<string, unknown>): string {
  const file = read(json);
  file.waypoints = file.waypoints.map((w) => {
    if (w.id !== id) return w;
    const next: Record<string, unknown> = { ...w };
    for (const [key, value] of Object.entries(patch)) {
      // heading and headingSource are nullable in the schema; everything else optional is simply absent.
      if (value === undefined || value === "") {
        if (key === "heading" || key === "headingSource") next[key] = null;
        else delete next[key];
      } else next[key] = value;
    }
    return next as RawPin;
  });
  return write(file);
}

/** Moves a pin to where it was dropped, snapped onto the track when close. Its place in the route order is kept. */
export function movePin(json: string, id: string, to: { lat: number; lng: number }, track: TrackLike): string {
  const { lat, lng } = snapToTrack(to, track);
  return updatePin(json, id, { lat, lng });
}

/** Points the pin's photo direction at a spot on the map (dragging the view cone's handle). */
export function aimPin(json: string, id: string, at: { lat: number; lng: number }): string {
  const pin = read(json).waypoints.find((w) => w.id === id);
  if (!pin) return json;
  return updatePin(json, id, { heading: Math.round(bearing(pin, at) * 10) / 10 % 360, headingSource: "manual" });
}

/** An id not used by any pin: `pin`, `pin-2`, `pin-3`… */
export function freeId(json: string, base = "pin"): string {
  const used = new Set(read(json).waypoints.map((w) => w.id));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * Adds a pin where the map was clicked (snapped onto the track when close) and slots it into the
 * route order by trail mileage, so a pin added between two others lands between them. Without a
 * track it goes last. On a stretch walked twice (out-and-back) it's placed on the first pass;
 * move it in the list if it belongs to the way back.
 */
export function addPin(json: string, at: { lat: number; lng: number }, track: TrackLike, type: WaypointType = "note"): { json: string; id: string } {
  const file = read(json);
  const id = freeId(json);
  const pos = snapToTrack(at, track);
  const pin: RawPin = { id, order: 0, type, label: "New pin", title: "New pin", lat: pos.lat, lng: pos.lng, heading: null, headingSource: null };
  let index = file.waypoints.length;
  if (track && file.waypoints.length) {
    const line = trackLine(track);
    const miles = locateAllOnTrack(line, file.waypoints).map((p) => p.mile);
    const mile = locateOnTrack(line, pos).mile;
    const after = miles.findIndex((m) => m > mile);
    if (after !== -1) index = after;
  }
  file.waypoints.splice(index, 0, pin);
  return { json: write(file), id };
}

export function removePin(json: string, id: string): string {
  const file = read(json);
  file.waypoints = file.waypoints.filter((w) => w.id !== id);
  return write(file);
}

/** Moves a pin one place earlier (-1) or later (+1) in the route order. */
export function reorderPin(json: string, id: string, by: -1 | 1): string {
  const file = read(json);
  const i = file.waypoints.findIndex((w) => w.id === id);
  const j = i + by;
  if (i === -1 || j < 0 || j >= file.waypoints.length) return json;
  [file.waypoints[i], file.waypoints[j]] = [file.waypoints[j], file.waypoints[i]];
  return write(file);
}

const ID = /^[a-z0-9-]+$/;

/** Blocks in the guide that point at this pin (`waypoint="id"`). */
export const referencesTo = (mdx: string, id: string) => (mdx.match(new RegExp(`\\bwaypoint="${id}"`, "g")) ?? []).length;

/**
 * Renames a pin and every block in the guide that refers to it, so the guide keeps working.
 * Returns the problem instead if the new id isn't usable.
 */
export function renamePin(json: string, mdx: string, id: string, nextId: string): { ok: true; json: string; mdx: string } | { ok: false; problem: string } {
  if (nextId === id) return { ok: true, json, mdx };
  if (!ID.test(nextId)) return { ok: false, problem: "Use lowercase letters, digits and dashes." };
  const file = read(json);
  if (file.waypoints.some((w) => w.id === nextId)) return { ok: false, problem: `Another pin is already called "${nextId}".` };
  file.waypoints = file.waypoints.map((w) => (w.id === id ? { ...w, id: nextId } : w));
  return { ok: true, json: write(file), mdx: mdx.replace(new RegExp(`\\bwaypoint="${id}"`, "g"), `waypoint="${nextId}"`) };
}

export type { RawPin };
