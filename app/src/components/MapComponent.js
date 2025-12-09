import { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Pane, FeatureGroup } from "react-leaflet";
import L from "leaflet";
import "leaflet.geodesic";
import * as turf from "@turf/turf";

import AirportMarker from "./AirportMarker";
import Legend from "./Legend";
import OverlayPanel from "./OverlayPanel";
import RouteInfoPanel from "./RouteInfoPanel";
import WelcomePopup from "./WelcomePopup";

import { useRoutes } from "../hooks/useRoutes";
import { useMonths } from "../hooks/useMonths";
import { useFlightAtlasStore } from "../store/useFlightAtlasStore";


import "leaflet/dist/leaflet.css";


// ---- Known Issues ---- 
// PRIORITY: 
// Points on other side of arcs
// Highlighted routes don't work if you hover over somewhere else -- Fixed?

// ---- Enhancements TODO ---- 
// Building and Selecting from URL
// Selecting Airport when Selected Airport event

const MapComponent = () => {
  // -------------------------
  // Component State
  // -------------------------
  const [selectedAirport, setSelectedAirport] = useState(null);       // JSON Object
  const [selectedAirline, setSelectedAirline] = useState("");         // Airline Code (AA, DL, F9, etc.)
  const [filteredAirports, setFilteredAirports] = useState([]);       // List of Airport GeoJSON Objects
  const [filteredAirlines, setFilteredAirlines] = useState([]);       // List of Airline maps
  const [selectedRoute, setSelectedRoute] = useState([]);             // List of [srcIATA, dstIATA], ex: ["GSO", "IAD"]
  const [showWelcome, setShowWelcome] = useState(false);              // Bool
  const [destinationAirport, setDestinationAirport] = useState(null); // JSON Object seperate from selected Airport and Highlighted Airport because it's now a Destination airport, used to draw a line from selected Airport
  const [selectedMonth, setSelectedMonth] = useState(
    String(new Date().getMonth() + 1));

  // -------------------------
  // Router vars
  // -------------------------

  // Auto-show welcome page on first visit
  useEffect(() => {
    const hasVisited = localStorage.getItem("hasVisited");
    if (!hasVisited) {
      setShowWelcome(true);
      localStorage.setItem("hasVisited", "true");
    }
  }, []);

  // Reference to the Leaflet map instance
  const mapRef = useRef(null);

  // Reference for airports and routes
  const routesLayerRef = useRef(null);

  // Reference for highlighted routes
  const highlightLayerRef = useRef(null);

  // Reference for a highlighted airport
  const highlightedAirportRef = useRef(null);

  // Default map position
  const DEFAULT_CENTER = [39.8283, -98.5795]; // center of continental US
  const DEFAULT_ZOOM = 4;

  // -------------------------
  // Load airport & airline data
  // -------------------------
  const { airports, airlines, loaded, initData } = useFlightAtlasStore();

  useEffect(() => {
    if (!loaded) {
      initData(selectedMonth);
    }
  }, [selectedMonth, loaded, initData]);

  // -------------------------
  // Load flight routes for the selected airport
  // -------------------------
  const { routes, loading, error } = useRoutes(selectedAirport, selectedAirline, selectedMonth);

  // -------------------------
  // Load available months
  // -------------------------
  const { months, loading: monthsLoading, error: monthsError } = useMonths();

  const routeRenderer = useMemo(
    () => L.canvas({ padding: 0.5 }), // a bit of padding helps with world copies
    []
  );

  // -------------------------
  // Draw lines function
  // -------------------------
  const drawLine = (coords, useGeodesic, lineWeight) => {
    const lineColor = "#64b5f7ff";

    if (useGeodesic) {
      return L.geodesic(coords, {
        color: lineColor,
        weight: lineWeight,
        opacity: 1.0,
        interactive: false,
        wrap: false,
        //renderer: routeRenderer,
      });
    }

    // regular polyline can take LatLng objects directly
    return L.polyline(coords, {
      color: lineColor,
      weight: lineWeight,
      opacity: 1.0,
      interactive: false,
      renderer: routeRenderer,
    });
  };

  // -------------------------
  // Function to render build variations of routes
  // -------------------------
  function buildWorldRouteVariants(coords) {
    const variants = [];

    // Primary coords
    variants.push(coords);

    // World copies left/right
    const plus360 = coords.map(([lat, lng]) => [lat, lng + 360]);
    const minus360 = coords.map(([lat, lng]) => [lat, lng - 360]);
    variants.push(plus360, minus360);

    return variants;
  }

  // -------------------------
  // Drawing routes and filtering airports, showing only airports that the routes go to
  // -------------------------
  useEffect(() => {

    const layer = routesLayerRef.current;
    // Ensure both the ref and data exist
    if (!layer || !routes?.features?.length) return;

    console.log("Drawing Routes and filtering by airports and airlines");

    // Clear previous routes
    layer.clearLayers();

    // Add each route as a Leaflet layer, store airline_code metadata
    const lines = [];

    // Line vars
    // if more than 200 routes, thinner line
    const routesLength = (routes.features.length > 200) ? 1 : 2

    // We'll track bounds only for the primary (non-world-copy) lines
    let primaryBounds = null;

    routes.features.forEach((f) => {
      const rawCoords = f.geometry.coordinates;

      // Convert to L.LatLng objects (lat, lng)
      const coords = rawCoords.map(([lng, lat]) => [lat, lng]);

      const src = coords[0];                      // [lat, lng]
      const dst = coords[coords.length - 1];      // [lat, lng]

      // Distance in miles (for future use if you want thresholds)
      const distance = turf.distance(
        turf.point([src[1], src[0]]),            // [lng, lat]
        turf.point([dst[1], dst[0]]),
        { units: "miles" }
      );

      const useGeodesic = distance > 1000;

      // Build all variants: base, ±360, and any antimeridian-wrapped variants
      const variants = buildWorldRouteVariants(coords);

      variants.forEach((variantCoords, idx) => {
        const line = drawLine(variantCoords, useGeodesic, routesLength);
        line.featureProps = f.properties;
        lines.push(line);

        // Only the first variant (base) contributes to bounds
        if (idx === 0) {
          const b = line.getBounds();
          if (b.isValid()) {
            primaryBounds = primaryBounds ? primaryBounds.extend(b) : b;
          }
        }
      });
    });

    // Add all lines at one moment
    lines.forEach(l => layer.addLayer(l));

    // Zoom to bounds of primary routes only
    if (mapRef.current && primaryBounds && primaryBounds.isValid()) {
      mapRef.current.fitBounds(primaryBounds, { padding: [15, 15] });
    }

    // --- Filter airports ---
    const airportCodes = new Set();
    const airlineDestinations = new Map();
    routes.features.forEach((f) => {

      // Define vars
      const airline = f.properties.airline_code;
      const dst = f.properties.dst_airport;
      const src = f.properties.src_airport;

      // Add airports to the set
      airportCodes.add(src);
      airportCodes.add(dst);

      // Add airline to set
      if (!airlineDestinations.has(airline)) {
        airlineDestinations.set(airline, new Set());
      }
      airlineDestinations.get(airline).add(dst);
    });

    // Define and set filtered airports
    const newFilteredAirports = airports.filter((airport) =>
      airportCodes.has(airport.properties.IATA)
    );
    setFilteredAirports(newFilteredAirports);

    // Build filtered airlines with counts
    if (!selectedAirline) {
      const newFilteredAirlines = Array.from(airlineDestinations.entries())
        .map(([code, destinationsSet]) => ({
          code,
          name: airlines[code] || "Unknown Airline",
          destinations: destinationsSet.size,
        }))
        .sort((a, b) => b.destinations - a.destinations);

      setFilteredAirlines(newFilteredAirlines);
      console.log(`Filtered ${newFilteredAirlines.length} airlines`);
    }

    console.log(`Filtered to ${layer.getLayers().length} routes`)
    console.log(`Filtered to ${newFilteredAirports.length} airports`);
  }, [routes]);

  // -------------------------
  // Update Routes when airline changes
  // -------------------------
  useEffect(() => {

    const layer = routesLayerRef.current;
    if (!layer) return;

    // Clear all if selected airport and selected airline are null
    if (!selectedAirport && !selectedAirline) {
      // setFilteredAirports to all airports and clear routes
      console.log("No airport/airline, showing all routes");
      layer.clearLayers();
      setFilteredAirports(airports);
      return;
    }

    console.log("Updating route and airport visibility");

    // Not just update routes but update airports too
    const visibleAirports = new Set();

    // Loop through each layer
    layer.eachLayer((l) => {

      // Get vars
      const airlineCode = l.featureProps?.airline_code;
      const shouldShow = !selectedAirline || selectedAirline === airlineCode;

      // Efficiently toggle visibility without re-adding/removing
      if (shouldShow) {
        visibleAirports.add(l.featureProps?.src_airport);
        visibleAirports.add(l.featureProps?.dst_airport);
        if (!mapRef.current.hasLayer(l)) mapRef.current.addLayer(l);
      } else {
        if (mapRef.current.hasLayer(l)) mapRef.current.removeLayer(l);
      }
    });

    // Define and set filtered airports
    const visibleAirportList = airports.filter((a) =>
      visibleAirports.has(a.properties.IATA)
    );
    setFilteredAirports(visibleAirportList);

    // Optionally zoom to visible routes only
    if (selectedAirline && mapRef.current) {
      const visibleLayers = [];
      layer.eachLayer((l) => {
        if (l.featureProps?.airline_code === selectedAirline) {
          visibleLayers.push(l);
        }
      });
      if (visibleLayers.length) {
        const bounds = L.featureGroup(visibleLayers).getBounds();
        if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [15, 15] });
      }
    }

  }, [selectedAirline, routes, selectedAirport]); // TODO REMOVE `selectedAirport` I am testing selecting and airport is selectAirline is defined

  // -------------------------
  // Highlight Arc if hovered over airport
  // -------------------------
  const updateHighlightedRoutes = (airport) => {

    const routesLayer = routesLayerRef.current;
    const highlightLayer = highlightLayerRef.current;

    // If Selected route, return only highlight selected route
    if (selectedRoute && selectedRoute.length === 2) return;

    // FIX TODO
    if (airport === null && highlightLayer) {
      highlightLayer.clearLayers();
      return;
    }

    // If no routes can't highlight any route
    // If not airport nothing to highlight
    // If selected route, return
    if (!routesLayer || !airport || selectedRoute?.length === 2) return;

    // Clear previous highlights
    highlightLayer.clearLayers();

    const highlightedIATA = airport.properties.IATA;

    console.log(`Highlighting Airport: ${highlightedIATA}`)

    if (selectedAirport) {
      const selectedIATA = selectedAirport.properties.IATA;
      const sameAirport = highlightedIATA === selectedIATA;
      routesLayer.eachLayer((l) => {
        const props = l.featureProps;
        if (!props) return;
        const { src_airport: src, dst_airport: dst } = props;
        const isMatch = sameAirport
          ? src === selectedIATA || dst === selectedIATA
          : (src === selectedIATA && dst === highlightedIATA) ||
          (dst === selectedIATA && src === highlightedIATA);
        if (isMatch) {
          const highlight = L.polyline(l.getLatLngs(), {
            color: "#004c97",
            weight: 4,
            opacity: 1.0,
            interactive: false,
            renderer: L.svg(),
          });
          highlightLayer.addLayer(highlight);
        }
      });
    } else {
      routesLayer.eachLayer((l) => {
        const props = l.featureProps;
        if (!props) return;
        const isMatch =
          props.src_airport === highlightedIATA ||
          props.dst_airport === highlightedIATA;
        if (isMatch) {
          const highlight = L.polyline(l.getLatLngs(), {
            color: "#004c97",
            weight: 4,
            opacity: 1.0,
            interactive: false,
            renderer: L.svg(),
          });
          highlightLayer.addLayer(highlight);
        }
      });
    }
  };

  useEffect(() => {

    // If no selectedRoute, skip
    if (!selectedRoute || selectedRoute.length < 2) return;

    console.log(`Highlighting Airport from ${selectedRoute[0]} to ${selectedRoute[1]}`)

    const routesLayer = routesLayerRef.current;
    const highlightLayer = highlightLayerRef.current;

    // If no routes or a highlight layer, skip
    if (!routesLayer || !highlightLayer) return;

    // Clear existing layer
    highlightLayer.clearLayers();

    // Get Airports
    const srcAirport = airports.find(a => a.properties.IATA === selectedRoute[0]);
    const dstAirport = airports.find(a => a.properties.IATA === selectedRoute[1]);
    if (!srcAirport || !dstAirport) return;

    // Extract coordinates [lat, lng]
    const srcLatLng = [srcAirport.geometry.coordinates[1], srcAirport.geometry.coordinates[0]];
    const dstLatLng = [dstAirport.geometry.coordinates[1], dstAirport.geometry.coordinates[0]];

    // Compute great-circle distance in miles
    const distance = turf.distance(
      turf.point([srcAirport.geometry.coordinates[0], srcAirport.geometry.coordinates[1]]),
      turf.point([dstAirport.geometry.coordinates[0], dstAirport.geometry.coordinates[1]]),
      { units: "miles" }
    );

    // Decide whether to use geodesic
    const useGeodesic = distance > 1000;

    // Styling
    const lineColor = "#004c97";
    const lineWeight = 4;

    // Build the route
    const coords = [srcLatLng, dstLatLng];
    const selectedAirportRoute = useGeodesic
      ? L.geodesic(coords, { color: lineColor, weight: lineWeight, opacity: 1.0, interactive: false })
      : L.polyline(coords, { color: lineColor, weight: lineWeight, opacity: 1.0, interactive: false, renderer: L.svg() });
    highlightLayer.addLayer(selectedAirportRoute);

    if (mapRef.current) {
      const bounds = L.latLngBounds(coords);
      if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }

  }, [selectedRoute]);

  // -------------------------
  // HandleBack
  // -------------------------
  const handleBack = () => {

    // If destination airport is selected, meaning selectedAirport is not null but selectedAirline could or could not be defined
    if (destinationAirport) {
      console.log("Clearing Destination Airport");
      setDestinationAirport(null);
      setSelectedRoute([]);

      // If no selectedRoute, clear if highlightLayer exists
      if (highlightLayerRef.current) {
        highlightLayerRef.current.clearLayers();
      }

      // Fit bounds
      const bounds = routesLayerRef.current.getBounds();
      if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [15, 15] });

      return;
    }

    // If selectedAirport is defined and selectedAirline, meaning clear airline and show all the routes
    if (selectedAirport && selectedAirline) {
      console.log("Clearing airline when airport is selected");
      setSelectedAirline("");

      // Fit bounds
      const bounds = routesLayerRef.current.getBounds();
      if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [15, 15] });

      return;
    }

    // If selectedAirport is defined, but not selectedAirline
    if (selectedAirport && !selectedAirline) {
      console.log("Clearing selected airport, no selected airline");
      setSelectedAirport(null);
      setSelectedAirline("");
      setFilteredAirlines(Object.entries(airlines || {}).map(([code, name]) => ({
        code,
        name,
      })));

      // Fit bounds
      mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

      return;
    }

    // If selectedAirline is defined but not airport meaning only showing routes of that airline then clear showing all routes again
    if (selectedAirline && !selectedAirport) {
      console.log("Clearing selected airline, No airport was selected");

      // Clear selected airline and format Filtered airlines back to original
      setSelectedAirline("");
      setFilteredAirlines(
        Object.entries(airlines || {}).map(([code, name]) => ({
          code,
          name,
        }))
      );
      // Clear Layers
      routesLayerRef.current.clearLayers()

      // Zoom to default
      mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

      return;
    }
  }

  // -------------------------
  // Memoize derived airlines prop
  // -------------------------
  const baseAirlines = useMemo(
    () =>
      Object.entries(airlines || {}).map(([code, name]) => ({
        code,
        name,
      })),
    [airlines]
  );

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="map-container" style={{ height: "100vh", width: "100%" }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        worldCopyJump={true}
        maxZoom={10}
        style={{ height: "100vh", width: "100%" }}
        ref={mapRef}
        zoomControl={false}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
          url='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
        />

        {/* Routes */}
        <Pane name="routesPane">
          <FeatureGroup ref={routesLayerRef} />
        </Pane>

        {/* Highlighted Routes */}
        <Pane name="highlightPane">
          <FeatureGroup ref={highlightLayerRef} />
        </Pane>

        {/* Airports */}
        <Pane name="airportsPane">
          {console.log("Rendering Airports")}
          {(filteredAirports.length ? filteredAirports : airports || [])
            .slice()
            .sort((a, b) => a.properties.destinations - b.properties.destinations)
            .map((airport) => (
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

        {/* Empty pane just to register it with Leaflet */}
        <Pane name="airportTooltipPane" />

        {/* Legend */}
        <Legend />

        {destinationAirport && routes?.features && (
          <RouteInfoPanel
            selectedAirport={selectedAirport}
            destinationAirport={destinationAirport}
            airlines={airlines}
            routes={routes}
            handleBack={handleBack}
          />
        )}

      </MapContainer>


      {/* Overlay controls*/}
      <OverlayPanel
        selectedAirport={selectedAirport}
        setSelectedAirport={setSelectedAirport}
        setSelectedAirline={setSelectedAirline}
        selectedAirline={selectedAirline}
        filteredAirlines={
          filteredAirlines && filteredAirlines.length
            ? filteredAirlines
            : baseAirlines
        }
        setSelectedRoute={setSelectedRoute}
        handleBack={handleBack}
        routes={routes}
        destinationAirport={destinationAirport}
        setDestinationAirport={setDestinationAirport}
        monthOptions={months}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        loading={loading || monthsLoading}
        error={error || monthsError}
      />


      {/*Info icon for welcome popup */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          right: 10,
          zIndex: 1100,
          background: "white",
          borderRadius: "50%",
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
        }}
        onClick={() => setShowWelcome(true)}
      >
        i
      </div>


      {/*Welcome Popup */}
      <WelcomePopup show={showWelcome} onClose={() => setShowWelcome(false)} />
    </div>

  );
};

export default MapComponent;