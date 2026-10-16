import { useEffect, useEffectEvent, useRef, useState } from "react";
import Feature, { type FeatureLike } from "ol/Feature";
import OlMap from "ol/Map";
import View from "ol/View";
import { defaults as defaultControls } from "ol/control/defaults";
import Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { Circle, Fill, Stroke, Style } from "ol/style";
import "ol/ol.css";

import { ATTRIBUTION, DEFAULT_CENTER, MAX_ZOOM, TILE_URL } from "@/components/atlas/basemap";
import { tokenValue } from "@/styles/tokens";
import styles from "./ProblemsMap.module.css";

export type ProblemPlace = {
  iata: string;
  name: string;
  coordinates: [number, number];
  count: number;
};

const styleCache = new Map<number, Style>();
const placeStyle = (feature: FeatureLike) => {
  const count = Math.min((feature.get("place") as ProblemPlace).count, 6);
  let style = styleCache.get(count);
  if (!style) {
    style = new Style({
      image: new Circle({
        radius: 3 + count,
        fill: new Fill({ color: tokenValue("--fa-color-error") }),
        stroke: new Stroke({ color: tokenValue("--fa-map-marker-stroke"), width: 0.5 }),
      }),
      zIndex: count,
    });
    styleCache.set(count, style);
  }
  return style;
};

type ProblemsMapProps = {
  places: ProblemPlace[];
  onSelect: (iata: string) => void;
};

/** The list below the map holds the same airports; the map only helps find them. */
export const ProblemsMap = ({ places, onSelect }: ProblemsMapProps) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const [layer] = useState(
    () => new VectorLayer({ source: new VectorSource(), style: placeStyle }),
  );
  const select = useEffectEvent(onSelect);

  useEffect(() => {
    const map = new OlMap({
      target: targetRef.current!,
      layers: [
        new TileLayer({ source: new XYZ({ url: TILE_URL, attributions: ATTRIBUTION }) }),
        layer,
      ],
      view: new View({ center: DEFAULT_CENTER, zoom: 3, maxZoom: MAX_ZOOM }),
      controls: defaultControls({ rotate: false, attributionOptions: { collapsible: false } }),
    });
    const viewport = map.getViewport();
    const placeAt = (pixel: number[]) =>
      map.forEachFeatureAtPixel(pixel, (f) => f.get("place") as ProblemPlace, {
        layerFilter: (l) => l === layer,
        hitTolerance: 6,
      });
    map.on("pointermove", (e) => {
      const place = placeAt(e.pixel);
      viewport.style.cursor = place ? "pointer" : "";
      viewport.title = place
        ? `${place.name} (${place.iata}): ${place.count} ${place.count === 1 ? "problem" : "problems"}`
        : "";
    });
    map.on("click", (e) => {
      const place = placeAt(e.pixel);
      if (place) select(place.iata);
    });
    return () => map.setTarget(undefined);
  }, [layer]);

  useEffect(() => {
    const source = layer.getSource()!;
    source.clear();
    source.addFeatures(
      places.map(
        (place) => new Feature({ geometry: new Point(fromLonLat(place.coordinates)), place }),
      ),
    );
  }, [places, layer]);

  return <div ref={targetRef} className={styles.map} aria-hidden />;
};
