import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import exifr from "exifr";
import { wp } from "./fixtures";
import { EXIF_OPTIONS, existingNumbering, inferHeadings, kebab, mergeWaypoints, photoKey, pinsFromPhotos, readPhotoMeta, sortByCapture, variantSize } from "../ingest";

describe("kebab", () => {
  it.each([
    ["IMG_3101.JPG", "img-3101"],
    ["Ridge view (2).jpeg", "ridge-view-2"],
    ["__x__.png", "x"],
  ])("%s → %s", (input, out) => expect(kebab(input)).toBe(out));
});

describe("inferHeadings", () => {
  const at = (lat: number, lng: number, heading: number | null = null) => ({ lat, lng, heading });

  it("keeps EXIF headings, rounded to 0.1°", () => {
    expect(inferHeadings([at(34, -118, 12.345)])).toEqual([{ heading: 12.3, headingSource: "exif" }]);
  });

  it("points at the next photo taken somewhere else", () => {
    const [first] = inferHeadings([at(34, -118), at(34.00001, -118), at(34, -117.99)]);
    expect(first.headingSource).toBe("inferred");
    expect(first.heading).toBeCloseTo(90, 0); // skips the same-spot photo, faces east
  });

  it("leaves the last photo blank", () => {
    expect(inferHeadings([at(34, -118), at(34.01, -118)])[1]).toEqual({ heading: null, headingSource: null });
  });
});

describe("mergeWaypoints", () => {
  // Out-and-back along a meridian: 34.00 → 34.01 → 34.00.
  const points: [number, number, number][] = [
    [-118, 34, 0],
    [-118, 34.01, 0],
    [-118, 34, 0],
  ];
  const track = { points, distanceMi: 1.38 };
  const at = (lat: number, lng = -118) => ({ lat, lng });
  const existing = [wp("trailhead", 10, "start", at(34)), wp("top", 20, "note", at(34.01))];

  it("interleaves new photos by trail mileage and renumbers order", () => {
    const incoming = [wp("wp-01", 0, "turn", at(34.005)), wp("wp-02", 0, "turn", at(34.004))]; // up, then on the way down
    const { waypoints } = mergeWaypoints(existing, incoming, track);
    expect(waypoints.map((w) => [w.id, w.order])).toEqual([
      ["trailhead", 10],
      ["wp-01", 20],
      ["top", 30],
      ["wp-02", 40],
    ]);
  });

  it("snaps nearby photos onto the track and leaves far ones where they are", () => {
    const near = wp("near", 0, "turn", at(34.005, -118.0003)); // ~28 m off
    const far = wp("far", 0, "turn", at(34.006, -117.998)); // ~185 m off
    const { waypoints, offTrack } = mergeWaypoints(existing, [near, far], track);
    expect(waypoints.find((w) => w.id === "near")!.lng).toBe(-118);
    expect(waypoints.find((w) => w.id === "far")!.lng).toBe(-117.998);
    expect(offTrack.map((o) => o.id)).toEqual(["far"]);
  });

  it("reports a side-trip photo's distance to the nearest point and doesn't let it advance the search", () => {
    const up = wp("up", 0, "turn", at(34.003));
    const side = wp("side", 0, "turn", at(34.0095, -117.997)); // ~280 m east, near the top
    const up2 = wp("up2", 0, "turn", at(34.006)); // still on the way up
    const { waypoints, offTrack } = mergeWaypoints(existing, [up, side, up2], track);
    expect(offTrack).toEqual([{ id: "side", offMi: expect.closeTo(0.172, 2), nearestMi: expect.closeTo(0.172, 2) }]);
    expect(waypoints.map((w) => w.id).indexOf("up2")).toBeLessThan(waypoints.map((w) => w.id).indexOf("top"));
  });

  it("keeps existing text and ids untouched", () => {
    const { waypoints } = mergeWaypoints(existing, [wp("wp-01", 0, "turn", at(34.005))], track);
    expect(waypoints[0]).toEqual({ ...existing[0], order: 10 });
  });

  it("appends after existing waypoints when there is no track", () => {
    const { waypoints } = mergeWaypoints(existing, [wp("wp-01", 0, "turn", at(34.005))]);
    expect(waypoints.map((w) => w.id)).toEqual(["trailhead", "top", "wp-01"]);
  });
});

describe("existingNumbering", () => {
  it("continues after the highest wp-NN id or photo number", () => {
    const list = [
      wp("trailhead", 10, "start", { photo: { key: "hike/03-img-1", kind: "flat" } }),
      wp("wp-07", 20),
      wp("ridge", 30),
    ];
    const { next, names } = existingNumbering(list);
    expect(next).toBe(8);
    expect([...names]).toEqual(["img-1"]);
  });

  it("starts at 1 for a hike without waypoints", () => {
    expect(existingNumbering([]).next).toBe(1);
  });
});

describe("readPhotoMeta", () => {
  it("reads position, capture time and heading", () => {
    const taken = new Date("2026-04-19T10:00:00Z");
    expect(readPhotoMeta({ latitude: 34.25, longitude: -118.1, GPSImgDirection: 370.5, DateTimeOriginal: taken }, { width: 4000, height: 3000 })).toEqual({
      lat: 34.25,
      lng: -118.1,
      takenAt: taken.getTime(),
      heading: 10.5,
      isPano: false,
    });
  });

  it("has no position without GPS, and nothing at all without EXIF", () => {
    expect(readPhotoMeta({ latitude: 34.25 }, { width: 4000, height: 3000 })).toMatchObject({ lat: null, lng: null });
    expect(readPhotoMeta(undefined, { width: 4000, height: 3000 })).toEqual({ lat: null, lng: null, takenAt: null, heading: null, isPano: false });
  });

  it("knows a 360° photo by its XMP or its 2:1 shape, and prefers its pose heading", () => {
    expect(readPhotoMeta({ ProjectionType: "equirectangular", PoseHeadingDegrees: 90, GPSImgDirection: 10 }, { width: 3000, height: 2000 })).toMatchObject({ isPano: true, heading: 90 });
    expect(readPhotoMeta({ GPSImgDirection: 10 }, { width: 6000, height: 3000 })).toMatchObject({ isPano: true, heading: 10 });
  });
});

describe("sortByCapture", () => {
  it("orders by time, then by name, and doesn't change its input", () => {
    const photos = [
      { name: "b.jpg", takenAt: 2000 },
      { name: "c.jpg", takenAt: 1000 },
      { name: "a.jpg", takenAt: 2000 },
      { name: "z.jpg", takenAt: null },
    ];
    expect(sortByCapture(photos).map((p) => p.name)).toEqual(["z.jpg", "c.jpg", "a.jpg", "b.jpg"]);
    expect(photos[0].name).toBe("b.jpg");
  });
});

describe("variantSize", () => {
  it("fits a flat photo inside the variant's longest edge, either way up", () => {
    expect(variantSize({ width: 4032, height: 3024 }, false, "full")).toEqual({ width: 2400, height: 1800 });
    expect(variantSize({ width: 3024, height: 4032 }, false, "thumb")).toEqual({ width: 360, height: 480 });
  });

  it("never enlarges", () => {
    expect(variantSize({ width: 800, height: 600 }, false, "full")).toEqual({ width: 800, height: 600 });
  });

  it("sizes a pano by its width", () => {
    expect(variantSize({ width: 8192, height: 4096 }, true, "full")).toEqual({ width: 6144, height: 3072 });
  });
});

describe("photoKey and pinsFromPhotos", () => {
  const photo = (key: string) => ({ key, lat: 34.1234567, lng: -118.7654321, heading: 12.3, headingSource: "exif" as const, isPano: false, width: 2400, height: 1800 });

  it("names a photo by the hike, its number and its file name", () => {
    expect(photoKey("granite-saddle", 7, "IMG_3101.JPG")).toBe("granite-saddle/07-img-3101");
  });

  it("makes the first photo of a new hike its trailhead and the rest turns", () => {
    const pins = pinsFromPhotos([photo("h/01-a"), photo("h/02-b")], { isNewHike: true });
    expect(pins.map((p) => [p.id, p.type, p.label])).toEqual([
      ["wp-01", "start", "Trailhead"],
      ["wp-02", "turn", "Photo 02"],
    ]);
    expect(pins[0]).toMatchObject({ lat: 34.123457, lng: -118.765432, heading: 12.3, headingSource: "exif", photo: { key: "h/01-a", kind: "flat", width: 2400, height: 1800 } });
  });

  it("doesn't reuse an id a pin already has", () => {
    expect(pinsFromPhotos([photo("h/03-a")], { isNewHike: false, usedIds: ["wp-03"] })[0]).toMatchObject({ id: "wp-03-2", type: "turn" });
  });
});

describe("the sample photos", () => {
  const dir = path.join(process.cwd(), "fixtures/sample-photos/granite-saddle");

  it("read back with a position, a time and mostly a heading, in walking order", async () => {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".jpg"));
    const photos = await Promise.all(
      files.map(async (name) => ({ name, ...readPhotoMeta(await exifr.parse(await readFile(path.join(dir, name)), EXIF_OPTIONS), { width: 1600, height: 1200 }) })),
    );
    expect(photos).toHaveLength(17);
    expect(photos.every((p) => p.lat !== null && p.lng !== null && p.takenAt !== null && !p.isPano)).toBe(true);

    const sorted = sortByCapture(photos);
    expect(sorted.map((p) => p.name)).toEqual([...files].sort());
    const headings = inferHeadings(sorted.map((p) => ({ lat: p.lat as number, lng: p.lng as number, heading: p.heading })));
    expect(headings.filter((h) => h.headingSource === "exif")).toHaveLength(13);
    expect(headings.filter((h) => h.headingSource === "inferred")).toHaveLength(4);
  });
});
