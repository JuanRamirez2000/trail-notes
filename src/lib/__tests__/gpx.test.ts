import { describe, expect, it } from "vitest";
import { buildTrack, elevationStats, parseGpx } from "../gpx";

const gpx = (pts: string) => `<?xml version="1.0"?><gpx><trk><trkseg>${pts}</trkseg></trk></gpx>`;

describe("parseGpx", () => {
  it("reads lat/lon/ele and drops everything else", () => {
    const xml = gpx(`
      <trkpt lat="34.1" lon="-118.2"><ele>1000.5</ele><time>2026-04-19T08:00:00Z</time><extensions><hr>140</hr></extensions></trkpt>
      <trkpt lon="-118.3" lat="34.2"><ele>1010</ele></trkpt>
      <trkpt lat="34.3" lon="-118.4"></trkpt>
      <trkpt lat='34.4' lon='-118.5'/>`);
    expect(parseGpx(xml)).toEqual([
      [-118.2, 34.1, 1000.5],
      [-118.3, 34.2, 1010],
      [-118.4, 34.3, NaN],
      [-118.5, 34.4, NaN],
    ]);
  });
});

describe("elevationStats", () => {
  it("smooths out GPS jitter before summing gain", () => {
    // ±2 m flip-flop on flat ground: raw gain would be ~25 × 4 m ≈ 328 ft.
    const jitter = Array.from({ length: 50 }, (_, i) => 100 + (i % 2 ? 2 : -2));
    expect(elevationStats(jitter).gainFt).toBeLessThan(328 / 10);
  });

  it("counts a steady climb and reports min/max in feet", () => {
    const climb = Array.from({ length: 101 }, (_, i) => i); // 0 → 100 m
    const s = elevationStats(climb);
    expect(s.maxFt).toBeCloseTo(328.08, 1);
    expect(s.minFt).toBe(0);
    expect(s.gainFt).toBeGreaterThan(300);
    expect(s.gainFt).toBeLessThanOrEqual(328.1);
  });

  it("ignores missing elevations", () => {
    expect(elevationStats([NaN, NaN])).toEqual({ gainFt: 0, maxFt: 0, minFt: 0 });
  });
});

describe("buildTrack", () => {
  it("simplifies the line but keeps full-resolution distance", () => {
    // 201 collinear points 0.0001° apart: simplification keeps only the ends.
    const raw = Array.from({ length: 201 }, (_, i) => [-118, 34 + i / 10_000, 1000] as [number, number, number]);
    const t = buildTrack(raw);
    expect(t.success).toBe(true);
    expect(t.data!.points).toHaveLength(2);
    expect(t.data!.distanceMi).toBeCloseTo(1.38, 2);
  });

  it("throws on fewer than two points", () => {
    expect(() => buildTrack([[-118, 34, 0]])).toThrow(/No track points/);
  });
});
