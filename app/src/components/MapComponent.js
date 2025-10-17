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
  const [highlightedAirport, setHighlightedAirport] = useState(null); // JSON Object seperate from selected Airport because you can hover over an airport but it's not the selected one 
  const [destinationAirport, setDestinationAirport] = useState(null); // JSON Object seperate from selected Airport and Highlighted Airport because it's now a Destination airport, used to draw a line from selected Airport

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
  // Set the selected route every time destinationAirport changes
  // -------------------------
  useEffect(() => {
    if (!destinationAirport || !selectedAirport) return;

    console.log("Setting Route when Destination Airport is defined");

    const route = routes.features.find(
      (f) =>
        f.properties.src_airport === selectedAirport.properties.IATA &&
        f.properties.dst_airport === destinationAirport.properties.IATA
    );

    setSelectedRoute(route || null);

    if (route && mapRef.current) {
      console.log("Fitting Route Bounds");
      mapRef.current.fitBounds(L.geoJson(route).getBounds(), {
        padding: [25, 25],
        animate: true,
        duration: 0.5,
      });
    }
  }, [destinationAirport, selectedAirport, routes]);

  // -------------------------
  // Compute displayed routes (filtered by selected airline)
  // -------------------------
  const displayedRoutes = React.useMemo(() => {
    if (!routes) return null;
    // If airline is selected, filter routes
    if (selectedAirline) {
      console.log("Updating Displayed Routes");
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

    // No return as destinationAirport and selectRoute go hand-and-hand
    if (destinationAirport) {
      console.log("Clearing Destination Airport");
      setDestinationAirport(null);

      // Fit bounds to current routes
      if (selectedAirport && routes) {
        console.log("Fitting Routes Bounds");
        mapRef.current.fitBounds(L.geoJson(routes).getBounds(), {
          padding: [15, 15],
          animate: true,
          duration: 0.5
        })
      };
    }

    // Clear route first
    if (selectedRoute) {
      console.log("Clearing Selected Route");
      setSelectedRoute(null);

      // Fit bounds to current routes
      if (selectedAirport && routes) {
        console.log("Fitting Routes Bounds");
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
      console.log("Clearing Selected Airline");
      setSelectedAirline("");

      // Fit bounds to current routes
      if (selectedAirport && routes) {
        console.log("Fitting Routes Bounds");
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
      console.log("Clearing Selected Airport");
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

    console.log("Updating Filtered Airports for the map");

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
    console.log("Resetting selections of new airport")
    setSelectedAirline("");
    setSelectedRoute(null);
  }, [selectedAirport]);


  // -------------------------
  // Fit bounds whenever the routes or airline changes
  // -------------------------
  useEffect(() => {

    // Reset Highlighted Airport
    setHighlightedAirport(null);

    // Wait for selectedRoute to be ready before fitting bounds
    if (selectedRoute) {
      console.log("Fitting Select Route Bounds");
      mapRef.current.fitBounds(L.geoJson(selectedRoute).getBounds(), {
        padding: [15, 15],
        animate: true,
        duration: 0.5,
      })
      return;
    }

    // Wait for displayedRoutes to be ready before fitting bounds
    if (displayedRoutes?.features?.length) {
      console.log("Fitting Displayed Routes Bounds");
      mapRef.current.fitBounds(L.geoJson(displayedRoutes).getBounds(), {
        padding: [15, 15],
        animate: true,
        duration: 0.5,
      });
      return;
    }


  }, [selectedAirport, selectedAirline, displayedRoutes, selectedRoute]);

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
              selectedAirport={selectedAirport}
              onSelectAirport={handleSelectAirport}
              highlightedAirport={highlightedAirport}
              setHighlightedAirport={setHighlightedAirport}
              destinationAirport={destinationAirport}
              setDestinationAirport={setDestinationAirport}
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
                setDestinationAirport={setDestinationAirport}
                selectedAirport={selectedAirport}
              />
              <AirportMarkers
                airports={filteredAirportsForMap}
                onSelectAirport={handleSelectAirport}
                highlightedAirport={highlightedAirport}
                setHighlightedAirport={setHighlightedAirport}
                radius={15}
                opacity={0.0}
                stroke={false}
                interactive={true}
                setDestinationAirport={setDestinationAirport}
                selectedAirport={selectedAirport}
              />
            </>
          )}
        </Pane>


        {/* Legend */}
        <Legend />

        {destinationAirport && (
          <RouteInfoPanel
            selectedAirport={selectedAirport}
            destinationAirport={destinationAirport}
            airlines={airlines}
            routes={routes}
            handleBack={handleBack}
          />
        )}

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
        destinationAirport={destinationAirport}
        setDestinationAirport={setDestinationAirport}
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