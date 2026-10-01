import { describe, expect, it } from "vitest";
import { cumulativeMiles } from "../geo";
import { deriveWaypoints, routeCoords } from "../hike";
import type { Track } from "../schemas";
import { wp } from "./fixtures";

/** Straight out-and-back: 11 points north, then back south to the start. */
function outAndBack(): Pick<Track, "points" | "distanceMi"> {
  const out = Array.from({ length: 11 }, (_, i) => [-118, 34 + i / 1000, 0] as [number, number, number]);
  const points = [...out, ...out.slice(0, -1).reverse()];
  const raw = cumulativeMiles(points.map(([lng, lat]) => ({ lat, lng })));
  return { points, distanceMi: raw.at(-1)! };
}

describe("deriveWaypoints", () => {
  it("sorts by order and numbers only required pins", () => {
    const derived = deriveWaypoints([wp("c", 30, "water"), wp("a", 10, "start"), wp("b", 20, "turn"), wp("d", 40, "bailout")]);
    expect(derived.map((w) => [w.id, w.stepIndex])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", null],
      ["d", 2],
    ]);
  });

  it("prefers an authored mile over the estimate", () => {
    const [, b] = deriveWaypoints([wp("a", 10), wp("b", 20, "turn", { mile: 4.2 })]);
    expect(b.mile).toBe(4.2);
  });

  it("estimates straight-line mileage without a track", () => {
    const [a, b] = deriveWaypoints([wp("a", 0), wp("b", 1000)]);
    expect(a.mile).toBe(0);
    expect(b.mile).toBeCloseTo(6.9, 1); // 0.1° of latitude
  });

  it("measures along the track, resolving an out-and-back by order", () => {
    const track = outAndBack();
    const total = track.distanceMi;
    const at = (lat: number) => ({ lat: 34 + lat / 1000, lng: -118 });
    const [start, outbound, top, inbound, end] = deriveWaypoints(
      [
        wp("start", 10, "start", at(0)),
        wp("outbound", 20, "turn", at(5)),
        wp("top", 30, "note", at(10)),
        wp("inbound", 40, "turn", at(5)), // same spot as "outbound", passed on the way back
        wp("end", 50, "note", at(0)),
      ],
      track,
    );
    expect(start.mile).toBe(0);
    expect(outbound.mile).toBeCloseTo(total / 4, 3);
    expect(top.mile).toBeCloseTo(total / 2, 3);
    expect(inbound.mile).toBeCloseTo((3 * total) / 4, 3);
    expect(end.mile).toBeCloseTo(total, 3);
  });

  it("rescales track mileage to the recorded distance", () => {
    const track = { ...outAndBack(), distanceMi: 10 };
    const [, top] = deriveWaypoints([wp("s", 10, "start", { lat: 34, lng: -118 }), wp("top", 20, "note", { lat: 34.01, lng: -118 })], track);
    expect(top.mile).toBeCloseTo(5, 6);
  });
});

describe("routeCoords", () => {
  it("uses the track when there is one, else waypoint to waypoint", () => {
    const wps = [wp("a", 10), wp("b", 20)];
    expect(routeCoords(wps)).toEqual(wps.map((w) => [w.lng, w.lat]));
    expect(routeCoords(wps, outAndBack())).toHaveLength(21);
  });
});
