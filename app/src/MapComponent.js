import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Popup, useMap, CircleMarker } from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import 'leaflet-arc'

const MapComponent = () => {
  const [airports, setAirports] = useState([]);
  const [routes, setRoutes] = useState(null);
  const [selectedAirport, setSelectedAirport] = useState(null);
  const [selectedAirline, setSelectedAirline] = useState("");
  const [airlines, setAirlines] = useState([]);
  const [airportQuery, setAirportQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const [filteredAirlines, setFilteredAirlines] = useState([]);
  const [allRoutes, setAllRoutes] = useState(null);


  // ---- FETCH HELPERS ----
  const fetchAirports = async () => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/airports`
      );
      let data = await res.json();
      if (typeof data === "string") data = JSON.parse(data);
      return data.features || [];
    } catch (err) {
      console.error("Error loading airports:", err);
      return [];
    }
  };

  const fetchAirlines = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/airlines`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      let data = await response.json();
      if (typeof data === 'string') data = JSON.parse(data);

      const airlineList = Object.entries(data).map(([code, name]) => ({
        code,
        name: String(name).replace(/[\r\n]+/g, ' ').trim(),
      }));

      return airlineList;
    } catch (err) {
      console.error("Error loading airlines:", err);
      return [];
    }
  };


  const fetchRoutes = async (iata, signal) => {
    let data;
    let attempts = 0;

    while (attempts < 10) {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/routes?airport=${iata}`, { signal });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      data = await response.json();
      if (typeof data === "string") data = JSON.parse(data);

      if (data.features && data.features.length > 0) break;

      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }
    return data;
  };

  // ---- LOAD DATA (with monthly cache) ----
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // ---- AIRPORTS ----
    const cachedAirports = localStorage.getItem("airports");
    const cachedAirportsMonth = localStorage.getItem("airports_month");

    if (cachedAirports && cachedAirportsMonth === currentMonth) {
      console.log("Loaded airports from cache");
      setAirports(JSON.parse(cachedAirports));
    } else {
      fetchAirports().then((data) => {
        setAirports(data);
        localStorage.setItem("airports", JSON.stringify(data));
        localStorage.setItem("airports_month", currentMonth);
        console.log("Fetched new airports for month:", currentMonth);
      });
    }

    // ---- AIRLINES ----
    const cachedAirlines = localStorage.getItem("airlines");
    const cachedAirlinesMonth = localStorage.getItem("airlines_month");

    if (cachedAirlines && cachedAirlinesMonth === currentMonth) {
      console.log("Loaded airlines from cache");
      setAirlines(JSON.parse(cachedAirlines));
    } else {
      fetchAirlines().then((data) => {
        setAirlines(data);
        localStorage.setItem("airlines", JSON.stringify(data));
        localStorage.setItem("airlines_month", currentMonth);
        console.log("Fetched new airlines for month:", currentMonth);
      });
    }
  }, []);


  // ---- SELECTED AIRPORT LOGIC ----
  useEffect(() => {
    if (!selectedAirport) return;

    const loadRoutes = async () => {
      setLoading(true);
      setError(null);

      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const iata = selectedAirport.properties.IATA;
        const data = await fetchRoutes(iata, controller.signal);
        const geojson = data.features
          ? data
          : { type: "FeatureCollection", features: data };

        setAllRoutes(geojson);   // store full route set
        setRoutes(geojson);      // initial filtered = all
      } catch (err) {
        if (err.name !== "AbortError") setError("Failed to load routes");
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();

    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [selectedAirport]);

  useEffect(() => {
    if (!allRoutes) return;

    const filteredGeojson = selectedAirline
      ? {
        ...allRoutes,
        features: allRoutes.features.filter(
          f => f.properties.airline_code === selectedAirline
        ),
      }
      : allRoutes;

    setRoutes(filteredGeojson);
  }, [selectedAirline, allRoutes]);

  useEffect(() => {
    if (!allRoutes || !airlines.length) return;

    const seenRoutes = new Set();
    const airlineCounts = {};

    allRoutes.features.forEach(f => {
      const { airline_code, src_airport, dst_airport } = f.properties;
      if (!airline_code || !src_airport || !dst_airport) return;

      const key = `${airline_code}_${src_airport}_${dst_airport}`;
      if (seenRoutes.has(key)) return;
      seenRoutes.add(key);

      airlineCounts[airline_code] = (airlineCounts[airline_code] || 0) + 1;
    });

    const uniqueAirlines = Object.entries(airlineCounts)
      .map(([code, count]) => {
        const airline = airlines.find(a => a.code === code);
        const name = airline ? airline.name : code;
        return { code, name, count };
      })
      .sort((a, b) => b.count - a.count);

    setFilteredAirlines(uniqueAirlines);
  }, [allRoutes, airlines]);

  const handleBack = () => {
    setRoutes(null);
    setAllRoutes(null);
    setSelectedAirport(null);
    setSelectedAirline("");
    setAirportQuery("");
    setFilteredAirlines([]);
  };

  const handleAirportSearch = () => {
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

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        worldCopyJump={true}
        style={{ height: "100vh", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />


        {/* Show airports when no route is selected */}
        {!selectedAirport &&
          airports.map((airport) => (
            <CircleMarker
              key={airport.properties.IATA}
              center={[
                airport.geometry.coordinates[1],
                airport.geometry.coordinates[0],
              ]}
              radius={6}
              color="blue"
              fillColor="lightblue"
              fillOpacity={0.8}
              eventHandlers={{
                click: () => setSelectedAirport(airport),
                mouseover: (e) => e.target.openPopup(),
                mouseout: (e) => e.target.closePopup(),
              }}
            >
              <Popup>
                <div>
                  <strong>{airport.properties.Name}</strong>
                  <br />
                  IATA: {airport.properties.IATA}
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* Routes Layer */}
        {routes && (
          <RouteLayer
            key={`route-layer-${Date.now()}`} // forces remount whenever routes change
            data={routes}
          />
        )}

        {/* ---- React-based overlay control ---- */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 1000,
            background: "white",
            padding: "12px 16px",
            borderRadius: "6px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            minWidth: "250px", // wider container
          }}
        >
          {/* Airport Search */}
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <label style={{ fontWeight: "bold", minWidth: "50px" }}>Airport:</label>
            <input
              type="text"
              placeholder="IATA (e.g. LAX)"
              value={airportQuery}
              maxLength={3}
              onChange={(e) =>
                setAirportQuery(
                  e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3)
                )
              }
              style={{
                padding: "6px 10px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                textTransform: "uppercase",
                flex: 1,      // takes remaining width
                minWidth: "120px",
              }}
            />
            <button
              onClick={handleAirportSearch}
              style={{
                border: "none",
                background: "#0078ff",
                color: "white",
                borderRadius: "4px",
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              →
            </button>
          </div>

          {/* Airline Dropdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontWeight: "bold" }}>Airline:</label>
            <select
              value={selectedAirline}
              onChange={(e) => setSelectedAirline(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
            >
              <option value="">All Airlines</option>
              {filteredAirlines.map((air) => (
                <option key={air.code} value={air.code}>
                  {air.name} ({air.count})
                </option>
              ))}
            </select>
          </div>

          {selectedAirport && (
            <button
              onClick={handleBack}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "#0078ff",
                alignSelf: "flex-start",
                marginTop: "4px",
              }}
            >
              ← Back
            </button>
          )}

          {loading && <span>Loading routes...</span>}
          {error && <span style={{ color: "red" }}>Error: {error}</span>}
        </div>

      </MapContainer>
    </div>
  );
};

// ---- ROUTE GEOJSON LAYER ----
const RouteLayer = ({ data }) => {
  const map = useMap();
  const geoRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!data || !data.features) return;

    // Remove previous layers
    if (geoRef.current) geoRef.current.removeFrom(map);
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const lineGroup = L.featureGroup();
    geoRef.current = lineGroup;

    // Load cached airports (GeoJSON format)
    const airports = JSON.parse(localStorage.getItem("airports")) || [];
    const airportsMap = new Map(airports.map(a => [a.properties.IATA, a]));

    // Add geodesic lines and markers
    data.features.forEach((feature) => {
      const coords = feature.geometry.coordinates;
      if (!coords || coords.length < 2) return;

      // Format for properties
      const { src_airport, dst_airport } = feature.properties;
      const srcFeature = airportsMap.get(src_airport);
      const dstFeature = airportsMap.get(dst_airport);

      // Get properties
      const srcName = srcFeature ? srcFeature.properties.Name : "Unknown Airport";
      const dstName = dstFeature ? dstFeature.properties.Name : "Unknown Airport";

      // Add geodesic line
      const line = L.Polyline.Arc(
        [coords[0][1], coords[0][0]], [coords[1][1], coords[1][0]],
        { weight: 2, color: "red", opacity: 0.8 }
      ).addTo(map);
      lineGroup.addLayer(line);
      markersRef.current.push(line);

      // Source marker
      const srcMarker = L.circleMarker([coords[0][1], coords[0][0]], {
        radius: 5,
        color: "green",
        fillColor: "lightgreen",
        fillOpacity: 0.8,
      }).addTo(map);
      srcMarker.bindPopup(`<b>${srcName}</b> (${src_airport})`);
      srcMarker.on("mouseover", () => srcMarker.openPopup());
      srcMarker.on("mouseout", () => srcMarker.closePopup());
      markersRef.current.push(srcMarker);

      // Destination marker
      const dstMarker = L.circleMarker([coords[1][1], coords[1][0]], {
        radius: 5,
        color: "red",
        fillColor: "pink",
        fillOpacity: 0.8,
      }).addTo(map);
      dstMarker.bindPopup(`<b>${dstName}</b> (${dst_airport})`);
      dstMarker.on("mouseover", () => dstMarker.openPopup());
      dstMarker.on("mouseout", () => dstMarker.closePopup());
      markersRef.current.push(dstMarker);
    });

    // Fit map to bounds of all lines
    if (lineGroup.getBounds().isValid()) {
      map.flyToBounds(lineGroup.getBounds(), {
        padding: [15, 15],
        duration: 0.75,
        easeLinearity: 0.25,
      });
    }

    // Cleanup on unmount or routes change
    return () => {
      if (geoRef.current) {
        geoRef.current.removeFrom(map);
        geoRef.current = null;
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      geoRef.current = null;
    };
  }, [data, map]);

  return null;
};

export default MapComponent;
