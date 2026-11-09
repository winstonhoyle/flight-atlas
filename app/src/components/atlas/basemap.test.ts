import { describe, expect, it } from "vitest";
import { fromLonLat } from "ol/proj";
import { createView } from "./basemap";

describe("createView", () => {
  it("fits arcs wider than the world, like LATAM's Pacific routes at -215 to 289 degrees", () => {
    const [west, south] = fromLonLat([-215, -45]);
    const [east, north] = fromLonLat([289, 60]);
    const size = [1440, 800];
    const padding = [40, 460, 40, 40];
    const view = createView();
    view.setViewportSize(size);
    view.fit([west, south, east, north], { size, padding });

    const resolution = view.getResolution()!;
    const visible = view.calculateExtent(size);
    expect(west).toBeGreaterThanOrEqual(visible[0] + padding[3] * resolution - 1);
    expect(east).toBeLessThanOrEqual(visible[2] - padding[1] * resolution + 1);
  });
});
