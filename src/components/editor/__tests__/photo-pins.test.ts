import { describe, expect, it } from "vitest";
import { waypointsFileSchema } from "@/lib/schemas";
import { addPhotoPins, placePhoto, type UploadedPhoto } from "../pins/photo-pins";

// Out-and-back along a meridian: 34.00 → 34.01 → 34.00.
const track = { points: [[-118, 34, 0], [-118, 34.01, 0], [-118, 34, 0]] as [number, number, number][], distanceMi: 1.38 };
const pins = (list: object[]) => `${JSON.stringify({ waypoints: list }, null, 2)}\n`;
const read = (json: string) => waypointsFileSchema.parse(JSON.parse(json)).waypoints;

const photo = (n: number, at: { lat: number; lng?: number } | null, takenAt: number | null, heading: number | null = null): UploadedPhoto => ({
  key: `hike/0${n}-img-${n}`,
  meta: { name: `IMG_${n}.jpg`, lat: at?.lat ?? null, lng: at ? (at.lng ?? -118) : null, takenAt, heading, isPano: false, width: 4000, height: 3000 },
  width: 2400,
  height: 1800,
});

describe("addPhotoPins", () => {
  it("makes a new hike's first photo its trailhead, in capture order whatever order they uploaded in", () => {
    const r = addPhotoPins(pins([]), [photo(2, { lat: 34.005 }, 2000, 90), photo(1, { lat: 34 }, 1000)], track);
    expect(read(r.json).map((w) => [w.id, w.type, w.label, w.order])).toEqual([
      ["wp-01", "start", "Trailhead", 10],
      ["wp-02", "turn", "Photo 02", 20],
    ]);
    expect(Object.fromEntries(r.pinned)).toEqual({ "hike/01-img-1": "wp-01", "hike/02-img-2": "wp-02" });
  });

  it("takes the direction from EXIF, else guesses it from the next photo and says so", () => {
    const r = addPhotoPins(pins([]), [photo(1, { lat: 34 }, 1000), photo(2, { lat: 34.005 }, 2000, 271.26)], track);
    const [first, second] = read(r.json);
    expect(first).toMatchObject({ heading: 0, headingSource: "inferred" }); // the next photo is due north
    expect(second).toMatchObject({ heading: 271.3, headingSource: "exif" });
  });

  it("snaps onto the track, slots in by trail mileage, and leaves existing pins exactly as written", () => {
    const existing = [
      { id: "trailhead", order: 10, type: "start", label: "Cedar Gap", title: "Start here", lat: 34, lng: -118, heading: null, headingSource: null, custom: "kept" },
      { id: "top", order: 20, type: "note", label: "Top", title: "Summit", lat: 34.01, lng: -118, heading: null, headingSource: null },
    ];
    // 34.004 on the way up (20 m off the line), then 34.003: behind it, so on the way back down.
    const r = addPhotoPins(pins(existing), [photo(3, { lat: 34.004, lng: -118.0002 }, 1000), photo(4, { lat: 34.003 }, 2000)], track);
    const out = JSON.parse(r.json).waypoints as Record<string, unknown>[];
    expect(out.map((w) => w.id)).toEqual(["trailhead", "wp-03", "top", "wp-04"]);
    expect(out[0]).toEqual({ ...existing[0], order: 10 });
    expect(Object.keys(out[0])).toEqual(Object.keys(existing[0]));
    expect(out[1]).toMatchObject({ lng: -118, type: "turn", photo: { key: "hike/03-img-3", kind: "flat", width: 2400, height: 1800 } });
    expect(r.offTrack).toEqual([]);
  });

  it("leaves a photo without GPS unplaced, and changes nothing if none has a position", () => {
    const json = pins([]);
    const r = addPhotoPins(json, [photo(1, null, 1000)], track);
    expect(r).toMatchObject({ json, unplaced: ["hike/01-img-1"] });
    expect(r.pinned.size).toBe(0);
    const mixed = addPhotoPins(json, [photo(1, null, 1000), photo(2, { lat: 34 }, 2000)], null);
    expect(mixed.unplaced).toEqual(["hike/01-img-1"]);
    expect(read(mixed.json)).toHaveLength(1);
  });

  it("never stores the capture time", () => {
    const r = addPhotoPins(pins([]), [photo(1, { lat: 34 }, 1_776_000_000_000)], track);
    expect(r.json).not.toMatch(/takenAt|1776000000000/);
  });

  it("reports a photo far from the trail and leaves it where its GPS put it", () => {
    const r = addPhotoPins(pins([]), [photo(1, { lat: 34.005, lng: -118.01 }, 1000)], track);
    expect(r.offTrack.map((o) => o.id)).toEqual(["wp-01"]);
    expect(read(r.json)[0].lng).toBe(-118.01);
  });
});

describe("placePhoto", () => {
  it("adds a pin for the photo where it was put, named after the photo", () => {
    const r = placePhoto(pins([]), { key: "hike/07-view", kind: "flat", width: 2400, height: 1800 }, { lat: 34.005, lng: -118.0001 }, track);
    expect(read(r.json)).toMatchObject([{ id: r.id, type: "turn", label: "Photo 07", title: "Photo 07", lng: -118, photo: { key: "hike/07-view" } }]);
  });
});
