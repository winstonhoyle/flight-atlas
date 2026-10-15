import { describe, expect, it } from "vitest";
import { distanceMiles, greatCircle } from "./geo";

describe("distanceMiles", () => {
  it("is zero for the same point", () => {
    expect(distanceMiles([-84.43, 33.64], [-84.43, 33.64])).toBe(0);
  });

  it("matches the ATL to LAX great-circle distance", () => {
    expect(distanceMiles([-84.428, 33.637], [-118.408, 33.943])).toBeCloseTo(1946, -1);
  });
});

describe("greatCircle", () => {
  it("starts and ends at the airports", () => {
    const points = greatCircle([-73.78, 40.64], [-0.45, 51.47], 32);
    expect(points).toHaveLength(33);
    expect(points[0][0]).toBeCloseTo(-73.78);
    expect(points[0][1]).toBeCloseTo(40.64);
    expect(points[32][0]).toBeCloseTo(-0.45);
    expect(points[32][1]).toBeCloseTo(51.47);
  });

  it("bows toward the pole between JFK and Heathrow", () => {
    const [, midLat] = greatCircle([-73.78, 40.64], [-0.45, 51.47], 32)[16];
    expect(midLat).toBeGreaterThan(51.47);
  });

  it("keeps longitudes continuous across the antimeridian", () => {
    const lngs = greatCircle([144.8, 13.48], [-157.92, 21.32], 16).map(([lng]) => lng);
    expect(lngs.at(-1)).toBeCloseTo(202.08);
    lngs.slice(1).forEach((lng, i) => expect(lng).toBeGreaterThan(lngs[i]));
  });

  it("returns the endpoints for one segment", () => {
    expect(greatCircle([-84.43, 33.64], [-71, 42.36], 1)).toHaveLength(2);
  });
});
