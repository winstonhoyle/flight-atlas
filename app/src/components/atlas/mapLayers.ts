import type { FeatureLike } from "ol/Feature";
import { createEmpty, extend } from "ol/extent";
import type Layer from "ol/layer/Layer";
import VectorLayer from "ol/layer/Vector";
import WebGLVectorLayer from "ol/layer/WebGLVector";
import type VectorSource from "ol/source/Vector";
import { Circle, Fill, Stroke, Style } from "ol/style";
import type { Rule } from "ol/style/flat";

import { tokenValue } from "@/styles/tokens";
import { DESTINATION_BINS, destinationBin, destinationColorToken } from "@/utils/destinations";
import type { Renderer } from "@/utils/renderer";

export const HIGHLIGHT_WEIGHT = 4;
const SERVICE_DASH = [6, 6];

const styleCache = new Map<string, Style>();
const cachedStyle = (key: string, make: () => Style) => {
  let style = styleCache.get(key);
  if (!style) styleCache.set(key, (style = make()));
  return style;
};

export const routeStyle = (highlighted: boolean, weight: number, dashed: boolean) =>
  cachedStyle(
    `route-${highlighted}-${weight}-${dashed}`,
    () =>
      new Style({
        stroke: new Stroke({
          color: tokenValue(highlighted ? "--fa-map-route-highlight" : "--fa-map-route"),
          width: highlighted ? HIGHLIGHT_WEIGHT : weight,
          lineDash: dashed ? SERVICE_DASH : undefined,
        }),
        zIndex: highlighted ? 1 : 0,
      }),
  );

const unreadableStyle = () =>
  cachedStyle(
    "airport-unreadable",
    () =>
      new Style({
        image: new Circle({
          radius: 3,
          fill: new Fill({ color: tokenValue("--fa-map-unreadable") }),
          stroke: new Stroke({ color: tokenValue("--fa-map-marker-stroke"), width: 0.5 }),
        }),
        zIndex: -1,
      }),
  );

// Compare mode counts changes, not destinations, so the destinations ramp doesn't apply.
const changedStyle = (changes: number) =>
  cachedStyle(
    `airport-changed-${changes}`,
    () =>
      new Style({
        image: new Circle({
          radius: 4 + Math.min(changes, 4),
          fill: new Fill({ color: tokenValue("--fa-map-route-highlight") }),
          stroke: new Stroke({ color: tokenValue("--fa-map-marker-stroke"), width: 0.5 }),
        }),
        zIndex: changes,
      }),
  );

export const airportStyle = (feature: FeatureLike) => {
  const destinations = (feature.get("destinations") as number) || 0;
  if (feature.get("unreadable")) return unreadableStyle();
  if (feature.get("changed")) return changedStyle(destinations);
  return cachedStyle(
    `airport-${destinations}`,
    () =>
      new Style({
        image: new Circle({
          radius: 3 + Math.min(destinations / 20, 4),
          fill: new Fill({
            color: tokenValue(destinationColorToken(destinationBin(destinations))),
          }),
          stroke: new Stroke({ color: tokenValue("--fa-map-marker-stroke"), width: 0.5 }),
        }),
        // Busier airports draw on top.
        zIndex: destinations,
      }),
  );
};

// The same looks as above for the GPU layers, which draw each rule in turn. The rules run from the
// fewest destinations to the most, so the busiest airports draw on top as they do on canvas.
export const airportFlatStyle = (): Rule[] => {
  const destinations = ["get", "destinations"];
  const stroke = {
    "circle-stroke-color": tokenValue("--fa-map-marker-stroke"),
    "circle-stroke-width": 0.5,
  };
  const plain = [
    ["==", ["get", "unreadable"], 0],
    ["==", ["get", "changed"], 0],
  ];
  return [
    {
      filter: ["==", ["get", "unreadable"], 1],
      style: {
        "circle-radius": 3,
        "circle-fill-color": tokenValue("--fa-map-unreadable"),
        ...stroke,
      },
    },
    {
      filter: ["==", ["get", "changed"], 1],
      style: {
        "circle-radius": ["+", 4, ["clamp", destinations, 0, 4]],
        "circle-fill-color": tokenValue("--fa-map-route-highlight"),
        ...stroke,
      },
    },
    ...DESTINATION_BINS.map((bin, i) => ({
      filter: [
        "all",
        ...plain,
        ...(i ? [[">", destinations, DESTINATION_BINS[i - 1].max]] : []),
        ...(Number.isFinite(bin.max) ? [["<=", destinations, bin.max]] : []),
      ],
      style: {
        "circle-radius": ["+", 3, ["clamp", ["/", destinations, 20], 0, 4]],
        "circle-fill-color": tokenValue(destinationColorToken(i + 1)),
        ...stroke,
      },
    })),
  ] as Rule[];
};

export const routeFlatStyle = (): Rule[] => {
  const stroke = {
    "stroke-color": tokenValue("--fa-map-route"),
    "stroke-width": ["var", "weight"],
  };
  return [
    {
      filter: ["==", ["get", "dashed"], 1],
      style: { ...stroke, "stroke-line-dash": SERVICE_DASH },
    },
    { filter: ["==", ["get", "dashed"], 0], style: stroke },
  ] as Rule[];
};

/** The box around every feature in the source. */
export const routesExtent = (source: VectorSource) => {
  const extent = createEmpty();
  source.forEachFeature((f) => {
    // A truthy return would stop forEachFeature after the first feature.
    extend(extent, f.getGeometry()!.getExtent());
  });
  return extent;
};

export type MapSources = {
  airportsSource: VectorSource;
  routesSource: VectorSource;
  highlightSource: VectorSource;
};

export type MapLayers = {
  airports: Layer;
  routes: { layer: Layer; setWeight: (n: number) => void };
  highlight: Layer;
};

export const layerList = (layers: MapLayers): Layer[] => [
  layers.routes.layer,
  layers.highlight,
  layers.airports,
];

/** The same three layers either way: all airports and routes on canvas or on the GPU, and the hovered routes on canvas. */
export const createLayers = (renderer: Renderer, sources: MapSources): MapLayers => {
  const highlight = new VectorLayer({
    source: sources.highlightSource,
    zIndex: 1.5,
    style: (f) => routeStyle(true, 0, f.get("dashed") === 1),
  });

  if (renderer === "webgl") {
    const airports = new WebGLVectorLayer({
      source: sources.airportsSource,
      zIndex: 2,
      style: airportFlatStyle(),
    });
    const routes = new WebGLVectorLayer({
      source: sources.routesSource,
      zIndex: 1,
      style: routeFlatStyle(),
      variables: { weight: 2 },
    });
    return {
      airports,
      routes: { layer: routes, setWeight: (weight) => routes.updateStyleVariables({ weight }) },
      highlight,
    };
  }

  const airports = new VectorLayer({
    source: sources.airportsSource,
    zIndex: 2,
    updateWhileAnimating: true,
    style: (f) => airportStyle(f),
  });
  let weight = 2;
  const routes = new VectorLayer({
    source: sources.routesSource,
    zIndex: 1,
    style: (f) => routeStyle(false, weight, f.get("dashed") === 1),
  });
  return {
    airports,
    routes: {
      layer: routes,
      setWeight: (next) => {
        if (next === weight) return;
        weight = next;
        routes.changed();
      },
    },
    highlight,
  };
};
