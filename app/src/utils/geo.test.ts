import { describe, expect, it } from "vitest";
import { distanceMiles } from "./geo";

describe("distanceMiles", () => {
  it("is zero for the same point", () => {
    expect(distanceMiles([-84.43, 33.64], [-84.43, 33.64])).toBe(0);
  });

  it("matches the ATL to LAX great-circle distance", () => {
    expect(distanceMiles([-84.428, 33.637], [-118.408, 33.943])).toBeCloseTo(1946, -1);
  });
});
