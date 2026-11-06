import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import VectorSource from "ol/source/Vector";
import { parseLiteralStyle } from "ol/render/webgl/style";
import { beforeAll, describe, expect, it } from "vitest";
import { DESTINATION_BINS } from "@/utils/destinations";
import {
  airportFlatStyle,
  airportStyle,
  createLayers,
  routeFlatStyle,
  routeStyle,
  routesExtent,
} from "./mapLayers";

const airport = (props: Record<string, unknown>) =>
  new Feature({ geometry: new Point([0, 0]), ...props });
const marker = (destinations: number) => airport({ destinations, unreadable: 0, changed: 0 });

describe("airportStyle", () => {
  it("draws every kind of airport", () => {
    expect(airportStyle(marker(0))).toBeDefined();
    expect(airportStyle(marker(200))).toBeDefined();
    expect(airportStyle(airport({ destinations: 0, unreadable: 1, changed: 0 }))).toBeDefined();
    expect(airportStyle(airport({ destinations: 1, unreadable: 0, changed: 1 }))).toBeDefined();
  });
});

describe("routeStyle", () => {
  it("is dashed only for seasonal or charter routes", () => {
    expect(routeStyle(false, 1, true).getStroke()?.getLineDash()).toEqual([6, 6]);
    expect(routeStyle(false, 1, false).getStroke()?.getLineDash()).toBeNull();
  });
});

describe("GPU styles", () => {
  it("style airports by kind and routes by weight and dash", () => {
    const rules = airportFlatStyle();
    expect(rules).toHaveLength(2 + DESTINATION_BINS.length);
    expect(rules[2].style).toMatchObject({ "circle-radius": expect.anything() });

    const [dashed, solid] = routeFlatStyle();
    expect(dashed.style).toMatchObject({
      "stroke-line-dash": [6, 6],
      "stroke-width": ["var", "weight"],
    });
    expect(solid.style).not.toHaveProperty("stroke-line-dash");
  });
});

describe("GPU style compilation", () => {
  beforeAll(() => {
    const tokens = [
      "--fa-map-marker-stroke",
      "--fa-map-unreadable",
      "--fa-map-route",
      "--fa-map-route-highlight",
      ...[1, 2, 3, 4, 5].map((n) => `--fa-map-destinations-${n}`),
    ];
    tokens.forEach((name) => document.documentElement.style.setProperty(name, "#336699"));
  });

  it("compiles every airport and route rule to shaders", () => {
    for (const rule of airportFlatStyle()) {
      expect(() => parseLiteralStyle(rule.style as never, {}, rule.filter)).not.toThrow();
    }
    for (const rule of routeFlatStyle()) {
      expect(() =>
        parseLiteralStyle(rule.style as never, { weight: 2 }, rule.filter),
      ).not.toThrow();
    }
  });
});

describe("createLayers", () => {
  const sources = () => ({
    airportsSource: new VectorSource(),
    routesSource: new VectorSource(),
    highlightSource: new VectorSource(),
  });

  it("builds the same layers on either renderer", () => {
    for (const renderer of ["canvas", "webgl"] as const) {
      const layers = createLayers(renderer, sources());
      expect(layers.airports.getZIndex()).toBeGreaterThan(layers.routes.layer.getZIndex()!);
      expect(layers.highlight.getZIndex()).toBeGreaterThan(layers.routes.layer.getZIndex()!);
      layers.airports.dispose();
      layers.routes.layer.dispose();
    }
  });
});

describe("routesExtent", () => {
  it("covers every route, not just the first", () => {
    const source = new VectorSource();
    source.addFeatures(
      [
        [
          [0, 0],
          [1, 1],
        ],
        [
          [0, 0],
          [50, -20],
        ],
        [
          [0, 0],
          [-30, 40],
        ],
      ].map((coordinates) => new Feature({ geometry: new LineString(coordinates) })),
    );
    expect(routesExtent(source)).toEqual([-30, -20, 50, 40]);
  });
});
