import React, { useState } from "react";
import { MapContainer, TileLayer, Pane } from "react-leaflet";

import AirportMarkers from "./AirportMarkers";
import OverlayPanel from "./OverlayPanel";
import RouteLayer from "./RouteLayer";

import { useAirportsAndAirlines } from "../hooks/useAirportsAndAirlines";
import { useRoutes } from "../hooks/useRoutes";
import { useFilteredAirlines } from "../hooks/useFilteredAirlines";
import { useFilteredRoutes } from "../hooks/useFilteredRoutes";

import "leaflet/dist/leaflet.css";

const MapComponent = () => {

  // -------------------------
  // Component State
  // -------------------------
  const [selectedAirport, setSelectedAirport] = useState(null);
  const [selectedAirline, setSelectedAirline] = useState("");
  const [airportQuery, setAirportQuery] = useState("");

  // -------------------------
  // Load airport & airline data
  // -------------------------
  // This hook fetches airports and airlines and caches them internally.
  // We just get the arrays here and use them to render markers and dropdown.
  const { airports, airlines } = useAirportsAndAirlines();

  // -------------------------
  // Load flight routes for the selected airport
  // -------------------------
  // `useRoutes` is a custom hook that:
  //   1. Watches the selectedAirport
  //   2. Fetches routes for that airport from the API
  //   3. Stores them in `allRoutes` (full dataset) and `routes` (filtered dataset)
  //   4. Handles loading state & errors
  const { routes, allRoutes, setRoutes, setAllRoutes, loading, error } = useRoutes(selectedAirport);

  // -------------------------
  // Filter routes by selected airline
  // -------------------------
  // Whenever `selectedAirline` changes, this hook updates `routes` to only include flights for that airline.
  useFilteredRoutes(allRoutes, selectedAirline, setRoutes);

  // -------------------------
  // Get list of airlines available for current airport routes
  // -------------------------
  // This filters the full airline list based on which airlines actually have flights from this airport.
  const allFilteredAirlines = useFilteredAirlines(allRoutes, airlines);

  // -------------------------
  // Event Handlers
  // -------------------------
  // Reset everything when the user clicks "Back"
  const handleBack = () => {
    setSelectedAirline("");
    setRoutes(null);
    setAllRoutes(null);
    setSelectedAirport(null);
    setAirportQuery("");
  };

  const handleAirportSearch = () => {
    // When user types a 3-letter IATA code and presses search
    if (airportQuery.length === 3) {
      const found = airports.find(
        (a) => a.properties.IATA === airportQuery.toUpperCase()
      );
      if (found) {
        setSelectedAirport(found);
      } else {
        alert(`Airport ${airportQuery} not found.`);
      }
    } else {
      alert("Please enter a 3-letter IATA code.");
    }
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        worldCopyJump={true}
        style={{ height: "100vh", width: "100%" }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
          url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
        />


        {/* Routes */}
        <Pane name="routesPane" style={{ zIndex: 400 }}>
          {routes && (
            <RouteLayer
              key={`route-layer-${Date.now()}`} // forces remount whenever routes change
              data={routes}
            />
          )}
        </Pane>

        {/* Airports */}
        <Pane name="airportsPane" style={{ zIndex: 500 }}>
          {!selectedAirport && (
            <AirportMarkers
              airports={airports}
              onSelectAirport={setSelectedAirport}
            />
          )}
        </Pane>

        {/* ---- overlay control ---- */}
        <OverlayPanel
          airportQuery={airportQuery}
          setAirportQuery={setAirportQuery}
          handleAirportSearch={handleAirportSearch}
          selectedAirline={selectedAirline}
          setSelectedAirline={setSelectedAirline}
          filteredAirlines={allFilteredAirlines}
          handleBack={handleBack}
          routes={routes}
          loading={loading}
          error={error}
        />

      </MapContainer>
    </div>
  );
};

export default MapComponent;
