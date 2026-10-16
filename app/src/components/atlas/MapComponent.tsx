import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Feature, { type FeatureLike } from "ol/Feature";
import OlMap from "ol/Map";
import Overlay from "ol/Overlay";
import View from "ol/View";
import { defaults as defaultControls } from "ol/control/defaults";
import type { Coordinate } from "ol/coordinate";
import { createEmpty, extend, isEmpty, type Extent } from "ol/extent";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import DragPan from "ol/interaction/DragPan";
import { defaults as defaultInteractions } from "ol/interaction/defaults";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import type { Pixel } from "ol/pixel";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { Circle, Fill, Stroke, Style } from "ol/style";
import "ol/ol.css";
import type { Position } from "geojson";

import { Legend } from "./Legend";
import { OverlayPanel } from "./OverlayPanel";
import { RouteInfo } from "./RouteInfo";
import { WelcomeDialog } from "./WelcomeDialog";
import tooltipStyles from "./AirportTooltip.module.css";
import styles from "./MapComponent.module.css";

import { IconButton } from "@/components/common/IconButton";

import { useAtlasData } from "@/hooks/useAtlasData";
import { useMonths } from "@/hooks/useMonths";
import { useRoutes } from "@/hooks/useRoutes";
import { useSelectionUrl } from "@/hooks/useSelectionUrl";
import { InfoIcon } from "@/icons";
import { tokenValue } from "@/styles/tokens";
import type { AirlineSummary, Airport, MonthOption, RouteProperties } from "@/types";
import { destinationBin, destinationColorToken } from "@/utils/destinations";
import { distanceMiles, greatCircle } from "@/utils/geo";
import { EMPTY_SELECTION, type Selection } from "@/utils/selectionPath";

const DEFAULT_CENTER = fromLonLat([-98.5795, 39.8283]); // center of continental US
const DEFAULT_ZOOM = 4;
const MAX_ZOOM = 10;
const GEODESIC_MIN_MILES = 1000;
const HIGHLIGHT_WEIGHT = 4;
const HIT_TOLERANCE = 8;
// Roughly half a tooltip's width and its height, in pixels.
const TOOLTIP_ROOM = [150, 60];
const WORLD_WIDTH = 2 * 20037508.342789244;

const animationMs = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600);

const TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ | Route data from <a href="https://en.wikipedia.org/" target="_blank" rel="noopener noreferrer">Wikipedia</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>)';

type RouteMatch = (route: RouteProperties) => boolean;

const routeGeometry = ([a, b]: Position[]) =>
  new LineString(
    greatCircle(a, b, distanceMiles(a, b) > GEODESIC_MIN_MILES ? 64 : 1).map((p) => fromLonLat(p)),
  );

/** The copy of x (one per world wrap) closest to `near`. */
const nearestCopy = (x: number, near: number) =>
  x + WORLD_WIDTH * Math.round((near - x) / WORLD_WIDTH);

const fitTo = (map: OlMap | null, extent: Extent, padding = 40) => {
  if (!map || isEmpty(extent)) return;
  const area = map.getViewport().getBoundingClientRect();
  const panel = document.getElementById("overlay-panel")?.getBoundingClientRect();
  const atSide = panel && panel.width < area.width / 2;
  const legend = document.getElementById("legend")?.getBoundingClientRect();
  map.getView().fit(extent, {
    padding: [
      panel && !atSide ? panel.bottom - area.top + padding : padding,
      panel && atSide ? area.right - panel.left + padding : padding,
      legend ? area.bottom - legend.top + padding : padding,
      padding,
    ],
    maxZoom: MAX_ZOOM,
    duration: animationMs(),
  });
};

const resetView = (map: OlMap | null) =>
  map?.getView().animate({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: animationMs() });

const routesExtent = (source: VectorSource, airline = "") => {
  const extent = createEmpty();
  source.forEachFeature((f) => {
    if (!airline || f.get("airline_code") === airline) extend(extent, f.getGeometry()!.getExtent());
  });
  return extent;
};

const airportAt = (map: OlMap, layer: VectorLayer, pixel: Pixel, coordinate: Coordinate) => {
  let nearest: Airport | null = null;
  let best = Infinity;
  for (const f of map.getFeaturesAtPixel(pixel, {
    layerFilter: (l) => l === layer,
    hitTolerance: HIT_TOLERANCE,
  })) {
    const [x, y] = (f.getGeometry() as Point).getCoordinates();
    const d = Math.hypot(nearestCopy(x, coordinate[0]) - coordinate[0], y - coordinate[1]);
    if (d < best) [best, nearest] = [d, f.get("airport") as Airport];
  }
  return nearest;
};

const styleCache = new Map<string, Style>();
const cachedStyle = (key: string, make: () => Style) => {
  let style = styleCache.get(key);
  if (!style) styleCache.set(key, (style = make()));
  return style;
};

const routeStyle = (highlighted: boolean, weight: number) =>
  cachedStyle(
    `route-${highlighted}-${weight}`,
    () =>
      new Style({
        stroke: new Stroke({
          color: tokenValue(highlighted ? "--fa-map-route-highlight" : "--fa-map-route"),
          width: highlighted ? HIGHLIGHT_WEIGHT : weight,
        }),
        zIndex: highlighted ? 1 : 0,
      }),
  );

const airportStyle = (feature: FeatureLike) => {
  const destinations = (feature.get("airport") as Airport).properties.destinations || 0;
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

const toAirlineSummaries = (airlines: Record<string, string>): AirlineSummary[] =>
  Object.entries(airlines).map(([code, name]) => ({ code, name }));

export const MapComponent = () => {
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [selectedAirline, setSelectedAirline] = useState("");
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("hasVisited"));
  const [destinationAirport, setDestinationAirport] = useState<Airport | null>(null);
  const [chosenSnapshot, setChosenSnapshot] = useState<MonthOption | null>(null);
  const [hovered, setHovered] = useState<Airport | null>(null);

  useEffect(() => {
    localStorage.setItem("hasVisited", "true");
  }, []);

  const targetRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OlMap | null>(null);

  const onClick = useEffectEvent((airport: Airport | null) => {
    if (!airport) return;
    if (selectedAirport) {
      if (airport.properties.IATA !== selectedAirport.properties.IATA)
        setDestinationAirport(airport);
      return;
    }
    if (!selectedAirline) setSelectedAirport(airport);
  });

  const [map] = useState(() => {
    const routesLayer = new VectorLayer({
      source: new VectorSource(),
      zIndex: 1,
      updateWhileAnimating: true,
    });
    const airportsLayer = new VectorLayer({
      source: new VectorSource(),
      style: airportStyle,
      zIndex: 2,
      updateWhileAnimating: true,
    });
    const tooltipElement = document.createElement("div");
    const tooltip = new Overlay({
      element: tooltipElement,
      positioning: "bottom-center",
      offset: [0, -10],
      stopEvent: false,
    });
    return { routesLayer, airportsLayer, tooltip, tooltipElement };
  });
  const routesSource = map.routesLayer.getSource()!;
  const airportsSource = map.airportsLayer.getSource()!;

  useEffect(() => {
    const { routesLayer, airportsLayer, tooltip } = map;
    const olMap = new OlMap({
      target: targetRef.current!,
      layers: [
        new TileLayer({ source: new XYZ({ url: TILE_URL, attributions: ATTRIBUTION }) }),
        routesLayer,
        airportsLayer,
      ],
      overlays: [tooltip],
      view: new View({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, maxZoom: MAX_ZOOM }),
      controls: defaultControls({
        zoom: false,
        rotate: false,
        attributionOptions: { collapsible: false },
      }),
      interactions: defaultInteractions({
        altShiftDragRotate: false,
        pinchRotate: false,
        dragPan: false,
      }).extend([new DragPan()]),
    });
    const hover = (airport: Airport | null, coordinate: Coordinate, [px, py]: Pixel) => {
      const below = py < TOOLTIP_ROOM[1];
      const width = olMap.getSize()![0];
      const side =
        px < TOOLTIP_ROOM[0] ? "left" : px > width - TOOLTIP_ROOM[0] ? "right" : "center";
      tooltip.setPositioning(`${below ? "top" : "bottom"}-${side}`);
      tooltip.setOffset([0, below ? 10 : -10]);
      setHovered(airport);
      const [x, y] = airport ? fromLonLat(airport.geometry.coordinates) : [0, 0];
      tooltip.setPosition(airport ? [nearestCopy(x, coordinate[0]), y] : undefined);
      olMap.getViewport().style.cursor = airport ? "pointer" : "";
    };
    olMap.on("pointermove", (e) => {
      if (e.dragging || (e.originalEvent as PointerEvent).pointerType !== "mouse") return;
      hover(airportAt(olMap, airportsLayer, e.pixel, e.coordinate), e.coordinate, e.pixel);
    });
    olMap.on("click", (e) => onClick(airportAt(olMap, airportsLayer, e.pixel, e.coordinate)));
    const leave = () => hover(null, [0, 0], [0, 0]);
    olMap.getViewport().addEventListener("mouseleave", leave);
    mapRef.current = olMap;
    return () => {
      olMap.getViewport().removeEventListener("mouseleave", leave);
      olMap.setTarget(undefined);
      mapRef.current = null;
    };
  }, [map]);

  const { months, loading: monthsLoading, error: monthsError } = useMonths();
  const {
    airports,
    routes: routeRows,
    airlines,
    loading,
    error: dataError,
  } = useAtlasData(chosenSnapshot);
  const routes = useRoutes(selectedAirport, selectedAirline, routeRows, airports);
  const locked = loading || monthsLoading;

  const findAirport = (iata: string) => airports.find((a) => a.properties.IATA === iata) ?? null;

  useSelectionUrl({
    ready: airports.length > 0 && Object.keys(airlines).length > 0,
    selection: {
      airport: selectedAirport?.properties.IATA ?? "",
      destination: destinationAirport?.properties.IATA ?? "",
      airline: selectedAirline,
    },
    airlineName: airlines[selectedAirline],
    resolve: ({ airport, destination, airline }) => {
      if (airport && !findAirport(airport)) return EMPTY_SELECTION;
      return {
        airport,
        destination: airport && findAirport(destination) ? destination : "",
        airline: airline in airlines ? airline : "",
      };
    },
    apply: (selection: Selection) => {
      setSelectedAirport(findAirport(selection.airport));
      setDestinationAirport(selection.destination ? findAirport(selection.destination) : null);
      setSelectedAirline(selection.airline);
    },
  });

  useEffect(() => {
    routesSource.clear();
    routesSource.addFeatures(
      (routes?.features ?? []).map(
        (f) => new Feature({ geometry: routeGeometry(f.geometry.coordinates), ...f.properties }),
      ),
    );
  }, [routes, routesSource]);

  useEffect(() => {
    if (selectedAirport && destinationAirport) {
      const ends = [selectedAirport, destinationAirport].map((a) => a.geometry.coordinates);
      fitTo(mapRef.current, routeGeometry(ends).getExtent(), 60);
    } else if (routes) {
      fitTo(mapRef.current, routesExtent(routesSource, selectedAirline));
    } else {
      resetView(mapRef.current);
    }
  }, [routes, selectedAirline, selectedAirport, destinationAirport, routesSource]);

  const highlight = useMemo<RouteMatch | null>(() => {
    const between =
      (a: string, b: string): RouteMatch =>
      ({ src_airport: src, dst_airport: dst }) =>
        (src === a && dst === b) || (src === b && dst === a);
    const selectedIATA = selectedAirport?.properties.IATA;
    if (selectedIATA && destinationAirport)
      return between(selectedIATA, destinationAirport.properties.IATA);
    if (!hovered) return null;
    const hoveredIATA = hovered.properties.IATA;
    if (selectedIATA && selectedIATA !== hoveredIATA) return between(selectedIATA, hoveredIATA);
    const target = selectedIATA ?? hoveredIATA;
    return ({ src_airport: src, dst_airport: dst }) => src === target || dst === target;
  }, [hovered, selectedAirport, destinationAirport]);

  useEffect(() => {
    const weight = (routes?.features.length ?? 0) > 200 ? 1 : 2;
    map.routesLayer.setStyle((feature) => {
      const route = feature.getProperties() as RouteProperties;
      if (selectedAirline && route.airline_code !== selectedAirline) return undefined;
      return routeStyle(highlight?.(route) ?? false, weight);
    });
  }, [selectedAirline, highlight, routes, map]);

  // Empty means show every airport.
  const filteredAirports = useMemo(() => {
    if (!routes || (!selectedAirport && !selectedAirline)) return [];
    const codes = new Set<string>();
    routes.features.forEach(({ properties: p }) => {
      if (!selectedAirline || p.airline_code === selectedAirline) {
        codes.add(p.src_airport);
        codes.add(p.dst_airport);
      }
    });
    return airports.filter((a) => codes.has(a.properties.IATA));
  }, [routes, airports, selectedAirport, selectedAirline]);

  const visibleAirports = filteredAirports.length ? filteredAirports : airports;

  useEffect(() => {
    airportsSource.clear();
    airportsSource.addFeatures(
      visibleAirports.map(
        (airport) =>
          new Feature({ geometry: new Point(fromLonLat(airport.geometry.coordinates)), airport }),
      ),
    );
  }, [visibleAirports, airportsSource]);

  const baseAirlines = useMemo(() => toAirlineSummaries(airlines), [airlines]);

  const filteredAirlines = useMemo<AirlineSummary[]>(() => {
    if (!selectedAirport || !routes) return baseAirlines;
    const destinations = new Map<string, Set<string>>();
    routes.features.forEach(({ properties: { airline_code, dst_airport } }) => {
      if (!destinations.has(airline_code)) destinations.set(airline_code, new Set());
      destinations.get(airline_code)!.add(dst_airport);
    });
    return [...destinations.entries()]
      .map(([code, dsts]) => ({
        code,
        name: airlines[code] || "Unknown Airline",
        destinations: dsts.size,
      }))
      .sort((a, b) => b.destinations - a.destinations);
  }, [selectedAirport, routes, airlines, baseAirlines]);

  const handleBack = () => {
    if (destinationAirport) return setDestinationAirport(null);
    setSelectedAirline("");
    if (!selectedAirline) setSelectedAirport(null);
  };

  const exploreFrom = (airport: Airport) => {
    setSelectedAirport(airport);
    setDestinationAirport(null);
    setSelectedAirline("");
  };

  return (
    <div className={styles.container}>
      <div ref={targetRef} className={styles.map} aria-busy={locked} />
      {locked && (
        <div className={styles.loading} aria-hidden>
          <span className={styles.loadingLabel}>Loading airports and routes…</span>
        </div>
      )}
      {createPortal(
        hovered && (
          <div className={tooltipStyles.tooltip}>
            <strong className={tooltipStyles.name}>{hovered.properties.Name}</strong>
            <span>
              {hovered.properties.IATA} · {hovered.properties.destinations} destinations
            </span>
          </div>
        ),
        map.tooltipElement,
      )}

      <Legend />

      <OverlayPanel
        airports={airports}
        selectedAirport={selectedAirport}
        setSelectedAirport={setSelectedAirport}
        setSelectedAirline={setSelectedAirline}
        selectedAirline={selectedAirline}
        filteredAirlines={filteredAirlines}
        handleBack={handleBack}
        routes={routes}
        destinationAirport={destinationAirport}
        setDestinationAirport={setDestinationAirport}
        monthOptions={months}
        snapshot={chosenSnapshot ?? months[0] ?? null}
        setSnapshot={setChosenSnapshot}
        loading={locked}
        error={monthsError || dataError}
      >
        {selectedAirport && destinationAirport && routes && (
          <RouteInfo
            selectedAirport={selectedAirport}
            destinationAirport={destinationAirport}
            airlines={airlines}
            routes={routes}
            onClose={handleBack}
            onExplore={exploreFrom}
          />
        )}
      </OverlayPanel>

      <IconButton
        label="About Flight Atlas"
        variant="floating"
        className={styles.infoButton}
        onClick={() => setShowWelcome(true)}
      >
        <InfoIcon />
      </IconButton>

      <WelcomeDialog open={showWelcome} onClose={() => setShowWelcome(false)} />
    </div>
  );
};
