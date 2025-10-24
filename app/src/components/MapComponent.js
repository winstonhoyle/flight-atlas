import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Pane, FeatureGroup } from "react-leaflet";
import L from "leaflet";
import "leaflet.geodesic";

import AirportMarker from "./AirportMarker";
import Legend from "./Legend";
import OverlayPanel from "./OverlayPanel";
import RouteInfoPanel from "./RouteInfoPanel";
import WelcomePopup from "./WelcomePopup";

import { useRoutes } from "../hooks/useRoutes";
import { useFlightAtlasStore } from "../store/useFlightAtlasStore";


import "leaflet/dist/leaflet.css";


// TODO LIST
// Fix url params after selected airport but with selected Airline /GSO/DL
// Fix Popups
// Fix All selectedAirline functionality without selectedAirport
// Fix smaller airports rendering on top
// potentially remove all airports without a 3 digit IATA code
// Fix Geodesic lines across the ocean

const MapComponent = () => {
  // -------------------------
  // Component State
  // -------------------------
  const [selectedAirport, setSelectedAirport] = useState(null);       // JSON Object
  const [selectedAirline, setSelectedAirline] = useState("");         // Airline Code (AA, DL, F9, etc.)
  const [filteredAirports, setFilteredAirports] = useState([])        // List of Airport GeoJSON Objects
  const [filteredAirlines, setFilteredAirlines] = useState([])        // List of Airline maps
  const [showWelcome, setShowWelcome] = useState(false);              // Bool
  const [highlightedAirport, setHighlightedAirport] = useState(null); // JSON Object seperate from selected Airport because you can hover over an airport but it's not the selected one 
  const [destinationAirport, setDestinationAirport] = useState(null); // JSON Object seperate from selected Airport and Highlighted Airport because it's now a Destination airport, used to draw a line from selected Airport

  // -------------------------
  // Router vars
  // -------------------------
  const navigate = useNavigate();
  const { paramSelectAirportCode, subParam, paramAirlineCode } = useParams();

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

  const didInitFromURL = useRef(false);

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
  const { routes, loading, error } = useRoutes(selectedAirport, selectedAirline);

  // -------------------------
  // Sync URL when selections change
  // -------------------------
  useEffect(() => {
    let path = "/";

    if (selectedAirline && !selectedAirport) {
      // Airline-only view
      path = `/airline/${selectedAirline}`;
    } else if (selectedAirport) {
      path = `/${selectedAirport.properties.IATA}`;
      if (destinationAirport) path += `/${destinationAirport.properties.IATA}`;
      else if (selectedAirline) path += `/${selectedAirline}`;
    }

    const currentPath = window.location.pathname;
    if (currentPath !== path) {
      navigate(path, { replace: true });
    }
  }, [selectedAirport, destinationAirport, selectedAirline, navigate]);

  // -------------------------
  // Auto-select based on URL params
  // -------------------------
  useEffect(() => {
    if (didInitFromURL.current) return;
    if (!loaded || !airports?.length) return;

    // --- Handle Airline-only route ---
    if (paramAirlineCode) {
      const code = paramAirlineCode.toUpperCase();
      if (airlines[code]) {
        console.log(`Found Airline ${airlines[code]} (${code}) from URL Path`);
        setSelectedAirport(null);
        setDestinationAirport(null);
        setSelectedAirline(code);
      }
      didInitFromURL.current = true;
      return;
    }

    // --- Handle Airport selection ---
    if (paramSelectAirportCode) {
      const code = paramSelectAirportCode.toUpperCase();
      const airport = airports.find(a => a.properties.IATA === code);
      if (airport) {
        console.log(`Found Destination Airport ${airport.properties.IATA} from URL Path`);
        setSelectedAirport(airport);
      }
    }

    // --- Handle subParam (destination or airline) ---
    if (subParam) {
      const code = subParam.toUpperCase();

      if (code.length === 3) {
        const destAirport = airports.find(a => a.properties.IATA === code);
        if (destAirport) {
          console.log(`Found Destination Airport ${destAirport.properties.IATA} from URL Path`);
          setDestinationAirport(destAirport);
          setSelectedAirline("");
          didInitFromURL.current = true;
          return;
        }
      }

      if (code.length === 2 && airlines[code]) {
        console.log(`Found Airline ${airlines[code]} (${code}) from URL Path`);
        setSelectedAirline(code);
        setDestinationAirport(null);
        didInitFromURL.current = true;
        return;
      }
    }

    // Fallback
    setDestinationAirport(null);
    setSelectedAirline("");
    didInitFromURL.current = true;
  }, [loaded, airports, airlines, paramSelectAirportCode, subParam, paramAirlineCode]);

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
    routes.features.forEach((f) => {
      const coords = f.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const line = L.geodesic(coords, {
        color: "#64b5f7ff",
        weight: 2,
        opacity: 1.0,
        interactive: false,
      });
      line.featureProps = f.properties; // keep a reference
      layer.addLayer(line);
    });


    // Zoom to bounds
    if (mapRef.current) {
      const bounds = layer.getBounds();
      if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [15, 15] });
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
    const newFilteredAirlines = Array.from(airlineDestinations.entries())
      .map(([code, destinationsSet]) => ({
        code,
        name: airlines[code] || "Unknown Airline",
        destinations: destinationsSet.size,
      }))
      .sort((a, b) => b.destinations - a.destinations);

    setFilteredAirlines(newFilteredAirlines);

    console.log(`Filtered to ${layer.getLayers().length} routes`)
    console.log(`Filtered to ${newFilteredAirports.length} airports`);
    console.log(`Filtered ${newFilteredAirlines.length} airlines`);
  }, [routes]);

  // -------------------------
  // Update visibility when airline changes
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

    console.log("Updating route and airport visibility by airline:", selectedAirline);

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

  }, [selectedAirline, routes]);

  // -------------------------
  // Highlight Arc if hovered over airport
  // -------------------------
  useEffect(() => {
    const layer = routesLayerRef.current;
    if (!layer || routesLayerRef.current.getLayers().length === 0) return;

    // No highlighted airport → reset all routes to normal
    if (!highlightedAirport) {
      console.log("Resetting line styles (no highlighted airport)"); // This is trigged one mouseout events
      layer.eachLayer((l) => {
        l.setStyle({
          color: "#64b5f7ff",
          weight: 2,
          opacity: 1.0,
        });
      });
      return;
    }

    const highlightedIATA = highlightedAirport.properties.IATA;

    // Logic for if selectedAirport, only rendering to and from the selected airport
    if (selectedAirport) {
      const selectedIATA = selectedAirport.properties.IATA;
      const sameAirport = highlightedIATA === selectedIATA;
      layer.eachLayer((l) => {
        const props = l.featureProps;
        if (!props) return;

        const src = props.src_airport;
        const dst = props.dst_airport;

        const isMatch = sameAirport
          ? src === selectedIATA || dst === selectedIATA // highlight all routes from selectedAirport
          : (src === selectedIATA && dst === highlightedIATA) ||
          (dst === selectedIATA && src === highlightedIATA); // highlight only that pair

        l.setStyle({
          color: isMatch ? "#004c97" : "#64b5f7ff",
          weight: isMatch ? 4 : 2,
          opacity: isMatch ? 1.0 : 0.5,
        });

        if (isMatch) l.bringToFront();
      });
      // Logic for if there are multiple routes from all different airports, highlight only routes from the highlighted airport
    } else {

      layer.eachLayer((l) => {
        const props = l.featureProps;
        if (!props) return;

        // Get boolean, if highlighted airport matches any src/dst airport of route, isMatch is `true`
        const isMatch = props.src_airport === highlightedIATA || props.dst_airport === highlightedIATA;

        l.setStyle({
          color: isMatch ? "#004c97" : "#64b5f7ff",
          weight: isMatch ? 4 : 2,
          opacity: isMatch ? 1.0 : 0.5,
        });
        if (isMatch) l.bringToFront();
      });
    }

  }, [highlightedAirport]);

  // -------------------------
  // HandleBack
  // -------------------------
  const handleBack = () => {

    // If destination airport is selected, meaning selectedAirport is not null but selectedAirline could or could not be defined
    if (destinationAirport) {
      console.log("Clearing Destination Airport");
      setDestinationAirport(null);

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
          <FeatureGroup ref={routesLayerRef} />
        </Pane>

        {/* Airports */}
        <Pane name="airportsPane" style={{ zIndex: 500 }}>
          {(filteredAirports.length ? filteredAirports : airports || []).map(
            (airport) => (
              <AirportMarker
                key={airport.properties.IATA}
                airport={airport}
                selectedAirport={selectedAirport}
                setSelectedAirport={setSelectedAirport}
                highlightedAirport={highlightedAirport}
                setDestinationAirport={setDestinationAirport}
                setHighlightedAirport={setHighlightedAirport}
              />
            )
          )}
        </Pane>

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
            : Object.entries(airlines || {}).map(([code, name]) => ({
              code,
              name,
            }))
        }
        handleBack={handleBack}
        routes={routes}
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