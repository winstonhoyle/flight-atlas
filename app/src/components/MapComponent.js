import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Pane } from "react-leaflet";
import L from "leaflet";


import AirportMarkers from "./AirportMarkers";
import Legend from "./Legend";
import OverlayPanel from "./OverlayPanel";
import RouteInfoPanel from "./RouteInfoPanel";
import RouteLayer from "./RouteLayer";
import WelcomePopup from "./WelcomePopup";


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
  const [showWelcome, setShowWelcome] = useState(false);              // Bool
  const [highlightedAirport, setHighlightedAirport] = useState(null); // JSON Object seperate from selected Airport because you can hover over a different airport


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
  // Event Handler for back button
  // -------------------------
  const handleBack = () => {

    console.log("Handling Back")

    // Clear route first
    if (selectedRoute) {
      setSelectedRoute(null);

      // Fit bounds to current routes
      if (selectedAirport && routes) {
        mapRef.current.fitBounds(L.geoJson(routes).getBounds(), {
          padding: [15, 15],
          animate: true,
          duration: 0.5
        })
      };
      return;
    }
    // If airline is selected, clear it
    if (selectedAirline) {
      setSelectedAirline("");

      // Fit bounds to current routes
      if (selectedAirport && routes) {
        mapRef.current.fitBounds(L.geoJson(routes).getBounds(), {
          padding: [15, 15],
          animate: true,
          duration: 0.5
        })
      };
      return;
    }

    // If airport is selected, clear it and reset map view
    if (selectedAirport) {
      setSelectedAirport(null);

      // Reset map
      mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM, {
        animate: true,
        duration: 0.5
      });
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


  // -------------------------
  // Fit bounds whenever the routes or airline changes
  // -------------------------
  useEffect(() => {
    if (displayedRoutes) {
      console.log("Fitting Bounds")
      mapRef.current.fitBounds(L.geoJson(displayedRoutes).getBounds(), {
        padding: [15, 15],
        animate: true,
        duration: 0.5
      })
    }
    setHighlightedAirport(null);
  }, [selectedAirline, displayedRoutes, setHighlightedAirport]);

  // Reset Airline filter if new airport is selected
  const handleSelectAirport = (airport) => {
    console.log("Reset Selected Airline")
    setSelectedAirport(airport);
    setSelectedAirline("");
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
        <Pane name="routesPane" style={{ zIndex: 400 }}>
          {displayedRoutes && (
            <RouteLayer
              key={`route-layer-${Date.now()}`}
              routes={displayedRoutes}
              setSelectedRoute={setSelectedRoute}
              selectedAirport={selectedAirport}
              onSelectAirport={handleSelectAirport}
              highlightedAirport={highlightedAirport}
              setHighlightedAirport={setHighlightedAirport}
            />
          )}
        </Pane>


        {/*Airports and invisible markers but larger radius */}
        <Pane name="airportsPane" style={{ zIndex: 500 }}>
          {!selectedAirport && (
            <>
              <AirportMarkers
                airports={filteredAirportsForMap}
                onSelectAirport={handleSelectAirport}
                highlightedAirport={highlightedAirport}
                setHighlightedAirport={setHighlightedAirport}
                interactive={false}
              />
              <AirportMarkers
                airports={filteredAirportsForMap}
                onSelectAirport={handleSelectAirport}
                highlightedAirport={highlightedAirport}
                setHighlightedAirport={setHighlightedAirport}
                radius={12}
                opacity={0.0}
                stroke={false}
                interactive={true}
              />
            </>
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