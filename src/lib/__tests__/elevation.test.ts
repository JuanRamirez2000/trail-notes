import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { elevationAt, elevationProfile, profileExtent } from "../elevation";
import { trackSchema, type Track } from "../schemas";

/** A climb north for `n` points, 10 m per point, then nothing else. */
function climb(n: number): Pick<Track, "points" | "distanceMi"> {
  return { points: Array.from({ length: n }, (_, i) => [-118, 34 + i / 1000, i * 10] as [number, number, number]), distanceMi: 5 };
}

describe("elevationProfile", () => {
  it("is null without a track", () => {
    expect(elevationProfile(null)).toBeNull();
    expect(elevationProfile(undefined)).toBeNull();
  });

  it("gives feet against trail miles, ending at the hike's distance", () => {
    const profile = elevationProfile(climb(11))!;
    expect(profile).toHaveLength(11);
    expect(profile[0]).toEqual([0, 0]);
    expect(profile.at(-1)).toEqual([5, 328]); // 100 m
    expect(profile[5][0]).toBeCloseTo(2.5, 2);
  });

  it("thins a long recording but keeps its ends, its summit and its low point", () => {
    const points = Array.from({ length: 4001 }, (_, i) => [-118, 34 + i / 100000, 1000 + 500 * Math.sin(i / 300)] as [number, number, number]);
    points[1234][2] = 2500; // a summit one sample wide
    points[3210][2] = 100; // and a dip
    const full = elevationProfile({ points, distanceMi: 9 }, Infinity)!;
    const thin = elevationProfile({ points, distanceMi: 9 }, 200)!;
    expect(thin.length).toBeLessThanOrEqual(200);
    expect(thin[0]).toEqual(full[0]);
    expect(thin.at(-1)).toEqual(full.at(-1));
    expect(profileExtent(thin)).toEqual(profileExtent(full));
    expect(thin.map((p) => p[0])).toEqual([...thin.map((p) => p[0])].sort((a, b) => a - b));
  });

  it("matches Cedar Ridge's recorded stats", () => {
    const track = trackSchema.parse(JSON.parse(readFileSync("fixtures/hikes/cedar-ridge/track.json", "utf8")));
    const extent = profileExtent(elevationProfile(track)!);
    expect(extent.totalMi).toBe(track.distanceMi);
    expect(Math.abs(extent.maxFt - track.maxElevationFt)).toBeLessThanOrEqual(10);
    expect(Math.abs(extent.minFt - track.minElevationFt)).toBeLessThanOrEqual(10);
    expect(extent.maxAtMi).toBeGreaterThan(3.4);
    expect(extent.maxAtMi).toBeLessThan(3.9);
  });
});

describe("elevationAt", () => {
  const profile = elevationProfile(climb(11))!;

  it("interpolates between samples", () => {
    expect(elevationAt(profile, 0.25)).toBeCloseTo((profile[0][1] + profile[1][1]) / 2, 0);
    expect(elevationAt(profile, profile[3][0])).toBe(profile[3][1]);
  });

  it("clamps outside the profile", () => {
    expect(elevationAt(profile, -1)).toBe(0);
    expect(elevationAt(profile, 99)).toBe(328);
  });
});
