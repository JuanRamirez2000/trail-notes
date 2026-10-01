import { describe, expect, it } from "vitest";
import { cumulativeMiles } from "../geo";
import { locateAllOnTrack, locateOnTrack, trackLine } from "../track";

/** Straight north for 0.01°, then straight back: vertices only at the ends and the turnaround. */
const OUT_AND_BACK = (() => {
  const points: [number, number, number][] = [
    [-118, 34, 0],
    [-118, 34.01, 0],
    [-118, 34, 0],
  ];
  const raw = cumulativeMiles(points.map(([lng, lat]) => ({ lat, lng })));
  return { points, distanceMi: raw.at(-1)! };
})();

describe("locateOnTrack", () => {
  const line = trackLine(OUT_AND_BACK);
  const total = OUT_AND_BACK.distanceMi;

  it("projects between vertices rather than snapping to the nearest one", () => {
    const p = locateOnTrack(line, { lat: 34.0025, lng: -118 });
    expect(p.index).toBe(0);
    expect(p.t).toBeCloseTo(0.25, 6);
    expect(p.mile).toBeCloseTo(total / 8, 6);
    expect(p.offMi).toBeCloseTo(0, 6);
  });

  it("reports how far off the track a point is and where it lands", () => {
    const p = locateOnTrack(line, { lat: 34.005, lng: -117.999 }); // ~0.057 mi east of the line
    expect(p.lng).toBeCloseTo(-118, 9);
    expect(p.lat).toBeCloseTo(34.005, 9);
    expect(p.offMi).toBeCloseTo(0.057, 2);
  });

  it("resolves a spot passed twice by searching forward", () => {
    const [out, top, back] = locateAllOnTrack(line, [
      { lat: 34.005, lng: -118 },
      { lat: 34.01, lng: -118 },
      { lat: 34.005, lng: -118 },
    ]);
    expect(out.mile).toBeCloseTo(total / 4, 6);
    expect(top.mile).toBeCloseTo(total / 2, 6);
    expect(back.mile).toBeCloseTo((3 * total) / 4, 6);
  });

  it("never steps backwards within the segment it resumes from", () => {
    const first = locateOnTrack(line, { lat: 34.006, lng: -118 });
    const second = locateOnTrack(line, { lat: 34.004, lng: -118 }, first);
    expect(second.mile).toBeGreaterThanOrEqual(first.mile);
  });
});
