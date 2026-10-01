import { describe, expect, it } from "vitest";
import { bearing, bounds, compassLabel, cumulativeMiles, distanceMi, normalizeHeading } from "../geo";

const A = { lat: 34, lng: -118 };
const NORTH = { lat: 34.01, lng: -118 };
const EAST = { lat: 34, lng: -117.99 };

describe("geo", () => {
  it("bearing is normalised to [0, 360)", () => {
    expect(bearing(A, NORTH)).toBeCloseTo(0, 5);
    expect(bearing(A, EAST)).toBeCloseTo(90, 1);
    expect(bearing(NORTH, A)).toBeCloseTo(180, 5);
    expect(bearing(EAST, A)).toBeCloseTo(270, 1);
  });

  it("measures distance in miles", () => {
    // 0.01° of latitude ≈ 0.69 mi
    expect(distanceMi(A, NORTH)).toBeCloseTo(0.69, 2);
  });

  it("accumulates straight-line mileage", () => {
    const miles = cumulativeMiles([A, NORTH, A]);
    expect(miles[0]).toBe(0);
    expect(miles[2]).toBeCloseTo(2 * miles[1], 10);
  });

  it("returns Mapbox-style bounds", () => {
    expect(bounds([A, NORTH, EAST])).toEqual([
      [-118, 34],
      [-117.99, 34.01],
    ]);
  });

  it.each([
    [0, "N"],
    [22, "N"],
    [23, "NE"],
    [350, "N"],
    [-90, "W"],
    [225, "SW"],
  ])("compassLabel(%d) = %s", (deg, label) => {
    expect(compassLabel(deg)).toBe(label);
  });

  it("normalizeHeading wraps negatives and overflow", () => {
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(725)).toBe(5);
  });
});
