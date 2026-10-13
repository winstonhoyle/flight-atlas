import { describe, expect, it } from "vitest";
import { destinationBin } from "./destinations";

describe("destinationBin", () => {
  it.each([
    [0, 1],
    [10, 1],
    [11, 2],
    [20, 2],
    [21, 3],
    [51, 4],
    [100, 4],
    [101, 5],
  ])("puts %i destinations in bin %i", (count, bin) => {
    expect(destinationBin(count)).toBe(bin);
  });
});
