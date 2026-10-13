import { useEffect, useMemo, useRef, useState } from "react";
import { FeatureGroup, MapContainer, Pane, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet.geodesic";
import "leaflet/dist/leaflet.css";

import { AirportMarker } from "./AirportMarker";
import { Legend } from "./Legend";
import { OverlayPanel } from "./OverlayPanel";
import { RouteInfoPanel } from "./RouteInfoPanel";
import { WelcomeDialog } from "./WelcomeDialog";
import styles from "./MapComponent.module.css";

import { IconButton } from "@/components/common/IconButton";

import { useAtlasData } from "@/hooks/useAtlasData";
import { useMonths } from "@/hooks/useMonths";
import { useRoutes } from "@/hooks/useRoutes";
import { InfoIcon } from "@/icons";
import { currentMonth } from "@/services/api";
import { tokenValue } from "@/styles/tokens";
import type { AirlineSummary, Airport, RouteProperties } from "@/types";
import { distanceMiles } from "@/utils/geo";

// ---- Known Issues ----
// PRIORITY:
// Points on other side of arcs
// Highlighted routes don't work if you hover over somewhere else -- Fixed?

// ---- Enhancements TODO ----
// Building and Selecting from URL
// Selecting Airport when Selected Airport event

const DEFAULT_CENTER: L.LatLngTuple = [39.8283, -98.5795]; // center of continental US
const DEFAULT_ZOOM = 4;
const GEODESIC_MIN_MILES = 1000;
const HIGHLIGHT_WEIGHT = 4;

// Route properties for each drawn line, so layers can be filtered and highlighted later.
const routePropsByLayer = new WeakMap<L.Layer, RouteProperties>();

const drawLine = (
  coords: L.LatLngTuple[],
  useGeodesic: boolean,
  weight: number,
  renderer: L.Renderer,
): L.Polyline => {
  const options = { color: tokenValue("--fa-map-route"), weight, opacity: 1.0, interactive: false };
  return useGeodesic
    ? L.geodesic(coords, { ...options, wrap: false })
    : L.polyline(coords, { ...options, renderer });
};

const highlightLine = (latLngs: L.LatLngExpression[] | L.LatLngExpression[][]) =>
  L.polyline(latLngs, {
    color: tokenValue("--fa-map-route-highlight"),
    weight: HIGHLIGHT_WEIGHT,
    opacity: 1.0,
    interactive: false,
    renderer: L.svg(),
  });

// The base line plus copies shifted ±360° so routes show on every world copy.
const buildWorldRouteVariants = (coords: L.LatLngTuple[]): L.LatLngTuple[][] => [
  coords,
  coords.map(([lat, lng]) => [lat, lng + 360]),
  coords.map(([lat, lng]) => [lat, lng - 360]),
];

const toAirlineSummaries = (airlines: Record<string, string>): AirlineSummary[] =>
  Object.entries(airlines).map(([code, name]) => ({ code, name }));

export const MapComponent = () => {
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [selectedAirline, setSelectedAirline] = useState("");
  // [srcIATA, dstIATA], e.g. ["GSO", "IAD"]
  const [selectedRoute, setSelectedRoute] = useState<string[]>([]);
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("hasVisited"));
  // Separate from selected and highlighted airports; the route line is drawn to it.
  const [destinationAirport, setDestinationAirport] = useState<Airport | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    localStorage.setItem("hasVisited", "true");
  }, []);

  const mapRef = useRef<L.Map | null>(null);
  const routesLayerRef = useRef<L.FeatureGroup | null>(null);
  const highlightLayerRef = useRef<L.FeatureGroup | null>(null);
  const highlightedAirportRef = useRef<Airport | null>(null);

  const { airports, airlines, error: dataError } = useAtlasData(selectedMonth);

  const { routes, loading, error } = useRoutes(selectedAirport, selectedAirline, selectedMonth);
  const { months, loading: monthsLoading, error: monthsError } = useMonths();

  // Padding helps with world copies.
  const routeRenderer = useMemo(() => L.canvas({ padding: 0.5 }), []);

  // Draw routes, then narrow the airports and airlines to the ones they touch.
  useEffect(() => {
    const layer = routesLayerRef.current;
    if (!layer || !routes?.features.length) return;

    layer.clearLayers();

    const weight = routes.features.length > 200 ? 1 : 2;
    const lines: L.Polyline[] = [];
    let primaryBounds: L.LatLngBounds | null = null;

    routes.features.forEach((f) => {
      const raw = f.geometry.coordinates;
      const coords = raw.map(([lng, lat]): L.LatLngTuple => [lat, lng]);
      const useGeodesic = distanceMiles(raw[0], raw[raw.length - 1]) > GEODESIC_MIN_MILES;

      buildWorldRouteVariants(coords).forEach((variantCoords, idx) => {
        const line = drawLine(variantCoords, useGeodesic, weight, routeRenderer);
        routePropsByLayer.set(line, f.properties);
        lines.push(line);

        // Only the base copy counts toward the zoom bounds.
        if (idx === 0) {
          const b = line.getBounds();
          if (b.isValid()) primaryBounds = primaryBounds ? primaryBounds.extend(b) : b;
        }
      });
    });

    lines.forEach((l) => layer.addLayer(l));

    if (mapRef.current && primaryBounds) {
      mapRef.current.fitBounds(primaryBounds, { padding: [15, 15] });
    }
  }, [routes, routeRenderer]);

  // Show only the selected airline's routes.
  useEffect(() => {
    const layer = routesLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;

    if (!selectedAirport && !selectedAirline) {
      layer.clearLayers();
      return;
    }

    const visibleLayers: L.Layer[] = [];
    layer.eachLayer((l) => {
      if (!selectedAirline || selectedAirline === routePropsByLayer.get(l)?.airline_code) {
        if (!map.hasLayer(l)) map.addLayer(l);
        if (selectedAirline) visibleLayers.push(l);
      } else if (map.hasLayer(l)) {
        map.removeLayer(l);
      }
    });

    if (visibleLayers.length) {
      const bounds = L.featureGroup(visibleLayers).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [15, 15] });
    }
  }, [selectedAirline, routes, selectedAirport]);

  // Airports touched by the visible routes; empty means show every airport.
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

  const baseAirlines = useMemo(() => toAirlineSummaries(airlines), [airlines]);

  // Airlines serving the selected airport, with destination counts.
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

  // Highlight the routes touching a hovered airport.
  const updateHighlightedRoutes = (airport: Airport | null) => {
    const routesLayer = routesLayerRef.current;
    const highlightLayer = highlightLayerRef.current;

    // A selected route keeps its own highlight.
    if (selectedRoute.length === 2) return;

    if (!airport) {
      highlightLayer?.clearLayers();
      return;
    }
    if (!routesLayer || !highlightLayer) return;

    highlightLayer.clearLayers();

    const hoveredIATA = airport.properties.IATA;
    const selectedIATA = selectedAirport?.properties.IATA;

    routesLayer.eachLayer((l) => {
      const props = routePropsByLayer.get(l);
      if (!props) return;
      const { src_airport: src, dst_airport: dst } = props;

      let isMatch: boolean;
      if (!selectedIATA || hoveredIATA === selectedIATA) {
        const target = selectedIATA ?? hoveredIATA;
        isMatch = src === target || dst === target;
      } else {
        isMatch =
          (src === selectedIATA && dst === hoveredIATA) ||
          (dst === selectedIATA && src === hoveredIATA);
      }

      if (isMatch)
        highlightLayer.addLayer(highlightLine((l as L.Polyline).getLatLngs() as L.LatLng[]));
    });
  };

  // Draw and zoom to the selected route.
  useEffect(() => {
    if (selectedRoute.length < 2) return;

    const highlightLayer = highlightLayerRef.current;
    if (!routesLayerRef.current || !highlightLayer) return;

    highlightLayer.clearLayers();

    const src = airports.find((a) => a.properties.IATA === selectedRoute[0]);
    const dst = airports.find((a) => a.properties.IATA === selectedRoute[1]);
    if (!src || !dst) return;

    const [srcLng, srcLat] = src.geometry.coordinates;
    const [dstLng, dstLat] = dst.geometry.coordinates;
    const coords: L.LatLngTuple[] = [
      [srcLat, srcLng],
      [dstLat, dstLng],
    ];

    const useGeodesic =
      distanceMiles(src.geometry.coordinates, dst.geometry.coordinates) > GEODESIC_MIN_MILES;
    highlightLayer.addLayer(
      useGeodesic
        ? L.geodesic(coords, {
            color: tokenValue("--fa-map-route-highlight"),
            weight: HIGHLIGHT_WEIGHT,
            opacity: 1.0,
            interactive: false,
          })
        : highlightLine(coords),
    );

    mapRef.current?.fitBounds(L.latLngBounds(coords), { padding: [30, 30] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoute]);

  const fitToRoutes = () => {
    const bounds = routesLayerRef.current?.getBounds();
    if (bounds?.isValid()) mapRef.current?.fitBounds(bounds, { padding: [15, 15] });
  };

  // Step back one level: destination, then airline, then airport.
  const handleBack = () => {
    if (destinationAirport) {
      setDestinationAirport(null);
      setSelectedRoute([]);
      highlightLayerRef.current?.clearLayers();
      fitToRoutes();
      return;
    }

    if (selectedAirport && selectedAirline) {
      setSelectedAirline("");
      fitToRoutes();
      return;
    }

    if (selectedAirport) {
      setSelectedAirport(null);
      setSelectedAirline("");
      mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    if (selectedAirline) {
      setSelectedAirline("");
      routesLayerRef.current?.clearLayers();
      mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  };

  const visibleAirports = (filteredAirports.length ? filteredAirports : airports)
    .slice()
    .sort((a, b) => a.properties.destinations - b.properties.destinations);

  return (
    <div className={styles.container}>
      <MapContainer
        className={styles.map}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        worldCopyJump={true}
        maxZoom={10}
        ref={mapRef}
        zoomControl={false}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ | Route data from <a href="https://en.wikipedia.org/" target="_blank" rel="noopener noreferrer">Wikipedia</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>)'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        />

        <Pane name="routesPane">
          <FeatureGroup ref={routesLayerRef} />
        </Pane>

        <Pane name="highlightPane">
          <FeatureGroup ref={highlightLayerRef} />
        </Pane>

        <Pane name="airportsPane">
          {visibleAirports.map((airport) => (
            <AirportMarker
              key={airport.properties.IATA}
              airport={airport}
              selectedAirport={selectedAirport}
              setSelectedAirport={setSelectedAirport}
              setDestinationAirport={setDestinationAirport}
              setSelectedRoute={setSelectedRoute}
              selectedAirline={selectedAirline}
              highlightedAirportRef={highlightedAirportRef}
              updateHighlightedRoutes={updateHighlightedRoutes}
            />
          ))}
        </Pane>

        {/* Registers the pane that airport tooltips render into */}
        <Pane name="airportTooltipPane" />

        <Legend />

        {selectedAirport && destinationAirport && routes && (
          <RouteInfoPanel
            selectedAirport={selectedAirport}
            destinationAirport={destinationAirport}
            airlines={airlines}
            routes={routes}
            handleBack={handleBack}
          />
        )}
      </MapContainer>

      <OverlayPanel
        airports={airports}
        selectedAirport={selectedAirport}
        setSelectedAirport={setSelectedAirport}
        setSelectedAirline={setSelectedAirline}
        selectedAirline={selectedAirline}
        filteredAirlines={filteredAirlines}
        setSelectedRoute={setSelectedRoute}
        handleBack={handleBack}
        routes={routes}
        destinationAirport={destinationAirport}
        setDestinationAirport={setDestinationAirport}
        monthOptions={months}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        loading={loading || monthsLoading}
        error={error || monthsError || dataError}
      />

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
