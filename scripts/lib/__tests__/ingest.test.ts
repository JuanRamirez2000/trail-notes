import { describe, expect, it } from "vitest";
import { wp } from "../../../src/lib/__tests__/fixtures";
import { existingNumbering, inferHeadings, kebab, mergeWaypoints } from "../ingest";

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
