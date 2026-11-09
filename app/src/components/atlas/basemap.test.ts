import { describe, expect, it } from "vitest";
import { fromLonLat, toLonLat } from "ol/proj";
import { AMERICAS_EXTENT, DEFAULT_CENTER, createView } from "./basemap";

describe("the default view", () => {
  it("opens on the middle of the Americas, not the United States", () => {
    expect(createView().getCenter()).toEqual(DEFAULT_CENTER);
    const [lng, lat] = toLonLat(DEFAULT_CENTER);
    expect(lng).toBeLessThan(-90);
    expect(lat).toBeLessThan(25);
  });

  it("fits Alaska to Tierra del Fuego on a laptop screen with the panel beside it", () => {
    const size = [1366, 768];
    const padding = [40, 420, 40, 40];
    const view = createView();
    view.setViewportSize(size);
    view.fit(AMERICAS_EXTENT, { size, padding });

    const resolution = view.getResolution()!;
    const visible = view.calculateExtent(size);
    expect(AMERICAS_EXTENT[0]).toBeGreaterThanOrEqual(visible[0] + padding[3] * resolution - 1);
    expect(AMERICAS_EXTENT[2]).toBeLessThanOrEqual(visible[2] - padding[1] * resolution + 1);
    expect(AMERICAS_EXTENT[1]).toBeGreaterThanOrEqual(visible[1] + padding[2] * resolution - 1);
    expect(AMERICAS_EXTENT[3]).toBeLessThanOrEqual(visible[3] - padding[0] * resolution + 1);
  });
});

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
