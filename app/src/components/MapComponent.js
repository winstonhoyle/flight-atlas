import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Pane, ZoomControl } from "react-leaflet";

import AirportMarkers from "./AirportMarkers";
import Legend from "./Legend";
import OverlayPanel from "./OverlayPanel";
import RouteInfoPanel from "./RouteInfoPanel";
import RouteLayer from "./RouteLayer";

import { useRoutes } from "../hooks/useRoutes";
import { useFilteredAirlines } from "../hooks/useFilteredAirlines";
import { useFlightAtlasStore } from "../store/useFlightAtlasStore";

import "leaflet/dist/leaflet.css";

const MapComponent = () => {
  // -------------------------
  // Component State
  // -------------------------
  const [selectedAirport, setSelectedAirport] = useState(null);       // JSON Object
  const [selectedAirline, setSelectedAirline] = useState("");         // Airline Code (AA, DL, F9, etc.)
  const [selectedRoute, setSelectedRoute] = useState(null);           // JSON Object

  // Reference to the Leaflet map instance
  const mapRef = useRef(null);

  // Default map position
  const DEFAULT_CENTER = [39.8283, -98.5795]; // center of continental US
  const DEFAULT_ZOOM = 4;

  // -------------------------
  // Load airport & airline data
  // -------------------------
  const { airports, airlines, loaded, initData } = useFlightAtlasStore();

  useEffect(() => {
    if (!loaded) {
      initData();
    }
  }, [loaded, initData]);

  // -------------------------
  // Load flight routes for the selected airport
  // -------------------------
  const { routes, allRoutes, loading, error } = useRoutes(selectedAirport, selectedAirline);

  // -------------------------
  // Compute displayed routes (filtered by selected airline)
  // -------------------------
  const displayedRoutes = React.useMemo(() => {
    if (!routes) return null;
    // If airline is selected, filter routes
    if (selectedAirline) {
      return {
        ...routes,
        features: routes.features.filter(
          (f) => f.properties.airline_code === selectedAirline
        ),
      };
    }

    return routes;
  }, [routes, selectedAirline]);

  // -------------------------
  // Event Handlers
  // -------------------------
  const handleBack = () => {

    // Clear route first
    if (selectedRoute) {
      setSelectedRoute(null);
      return;
    }

    // Step 1: If airline is selected, clear it
    if (selectedAirline) {
      setSelectedAirline("");
      return;
    }

    // Step 2: If airport is selected, clear it and reset map view
    if (selectedAirport) {
      setSelectedAirport(null);
      mapRef.current.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.75 });
      return;
    }
  };

  // -------------------------
  // Filter airports to only show those involved in currently loaded routes
  // -------------------------
  const filteredAirportsForMap = React.useMemo(() => {
    if (!allRoutes || !allRoutes.features) return airports;

    const airportCodes = new Set();
    (displayedRoutes || allRoutes).features.forEach((f) => {
      airportCodes.add(f.properties.src_airport);
      airportCodes.add(f.properties.dst_airport);
    });

    return airports.filter((a) => airportCodes.has(a.properties.IATA));
  }, [allRoutes, displayedRoutes, airports]);

  // -------------------------
  // Filter airlines based on current airport routes
  // -------------------------
  // Function that returns only the selected airlines 
  const allFilteredAirlines = useFilteredAirlines(allRoutes, airlines, selectedAirport);

  // -------------------------
  // Reset selections when a new airport is chosen
  // -------------------------
  useEffect(() => {
    setSelectedAirline("");
    setSelectedRoute(null);
  }, [selectedAirport]);

  const handleSelectAirport = (airport) => {
    setSelectedAirport(airport);
    setSelectedAirline(""); // reset airline filter on new airport
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="map-container" style={{ height: "100vh", width: "100%" }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        worldCopyJump={true}
        zoomControl={false}
        maxZoom={10}
        style={{ height: "100vh", width: "100%" }}
        ref={mapRef}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
          url='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
        />
        <ZoomControl position="bottomright" />

        {/* Routes */}
        <Pane name="routesPane" style={{ zIndex: 400 }}>
          {displayedRoutes && (
            <RouteLayer
              key={`route-layer-${Date.now()}`}
              routes={displayedRoutes}
              selectedRoute={selectedRoute}
              setSelectedRoute={setSelectedRoute}
              onSelectAirport={handleSelectAirport}
            />
          )}
        </Pane>

        {/* Airports */}
        <Pane name="airportsPane" style={{ zIndex: 500 }}>
          {!selectedAirport && (
            <AirportMarkers
              airports={filteredAirportsForMap}
              onSelectAirport={handleSelectAirport}
            />
          )}
        </Pane>

        {/* Legend */}
        <Legend />

        {/* Route Info Panel */}
        <RouteInfoPanel
          route={selectedRoute}
          routes={allRoutes}
          airports={airports}
          airlines={airlines}
          onClose={() => setSelectedRoute(null)}
        />
      </MapContainer>

      {/* Overlay controls */}
      <OverlayPanel
        selectedAirport={selectedAirport}
        setSelectedAirport={setSelectedAirport}
        setSelectedAirline={setSelectedAirline}
        selectedAirline={selectedAirline}
        filteredAirlines={allFilteredAirlines.length ? allFilteredAirlines : airlines}
        handleBack={handleBack}
        routes={displayedRoutes}
        loading={loading}
        error={error}
      />
    </div>
  );
};

export default MapComponent;
