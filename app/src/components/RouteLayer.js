import React, { useEffect, useRef } from "react";
import { useMap, FeatureGroup } from "react-leaflet";

import "leaflet-arc";

import ArcLine from "./ArcLine";
import AirportMarkers from "./AirportMarkers";

const RouteLayer = ({ routes, setSelectedRoute, onSelectAirport }) => {
  const map = useMap();
  const groupRef = useRef();

  // Fit bounds whenever data changes
  useEffect(() => {
    if (routes?.features?.length && groupRef.current) {
      const group = groupRef.current;
      if (group.getBounds && group.getBounds().isValid()) {
        map.flyToBounds(group.getBounds(), { padding: [15, 15], duration: 0.75 });
      }
    }
  }, [routes, map]);

  if (!routes || !routes.features) return null;

  // Get airports
  const airports = JSON.parse(localStorage.getItem("airports")) || [];
  const airportsMap = new Map(airports.map(a => [a.properties.IATA, a]));

  // Collect all airports used in routes
  const airportSet = new Set();
  routes.features.forEach(f => {
    airportSet.add(f.properties.src_airport);
    airportSet.add(f.properties.dst_airport);
  });
  const airportsForMarkers = Array.from(airportSet)
    .map(code => airportsMap.get(code))
    .filter(Boolean);

  // Build Layer (FeatureGroup)
  return (
    <FeatureGroup ref={groupRef}>
      {/* Render all routes as arcs */}
      {routes.features.map((f, idx) => {
        const coords = f.geometry.coordinates;
        if (!coords || coords.length < 2) return null;
        const srcCoord = [coords[0][1], coords[0][0]];
        const dstCoord = [coords[1][1], coords[1][0]];

        return (
          <ArcLine
            key={`${f.properties.src_airport}-${f.properties.dst_airport}-${f.properties.airline_code}-${idx}`}
            from={srcCoord}
            to={dstCoord}
            onClick={() => setSelectedRoute(f.properties, routes.features, airports)}
          />
        );
      })}

      {/* Render all airports using the existing AirportMarkers component */}
      <AirportMarkers airports={airportsForMarkers} onSelectAirport={onSelectAirport}/>
    </FeatureGroup>
  );
};

export default RouteLayer;