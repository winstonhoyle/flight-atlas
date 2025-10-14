import React, { useEffect, useRef, useMemo } from "react";
import { useMap, FeatureGroup } from "react-leaflet";
import L from "leaflet";
import ArcLine from "./ArcLine";
import AirportMarkers from "./AirportMarkers";

const RouteLayer = ({ routes, setSelectedRoute, onSelectAirport }) => {
  const map = useMap();
  const groupRef = useRef();

  // Memoize routeFeatures to make it stable for Hooks
  const routeFeatures = useMemo(() => routes?.features || [], [routes?.features]);

  // Get airports (memoized)
  const airports = useMemo(() => JSON.parse(localStorage.getItem("airports")) || [], []);

  const airportsMap = useMemo(() => new Map(airports.map(a => [a.properties.IATA, a])), [airports]);

  const airportSet = useMemo(() => {
    const set = new Set();
    routeFeatures.forEach(f => {
      set.add(f.properties.src_airport);
      set.add(f.properties.dst_airport);
    });
    return set;
  }, [routeFeatures]);

  const airportsForMarkers = useMemo(() => {
    const result = [];

    airportSet.forEach(code => {
      const airport = airportsMap.get(code);
      if (!airport) return;

      const [lng, lat] = airport.geometry.coordinates;

      // Base marker
      result.push({ ...airport, geometry: { coordinates: [lng, lat] } });

      // Duplicate for antimeridian crossing
      const crossesAntimeridian = routeFeatures.some(f => {
        const srcLng = f.geometry.coordinates[0][0];
        const dstLng = f.geometry.coordinates[1][0];
        return (f.properties.src_airport === code || f.properties.dst_airport === code)
          ? Math.abs(dstLng - srcLng) > 180
          : false;
      });

      if (crossesAntimeridian) {
        result.push({ ...airport, geometry: { coordinates: [lng + 360, lat] } });
        result.push({ ...airport, geometry: { coordinates: [lng - 360, lat] } });
      }
    });

    return result;
  }, [airportSet, airportsMap, routeFeatures]);

  // Fit bounds
  useEffect(() => {
    const validAirports = airportsForMarkers.filter(a => {
      const lng = a.geometry.coordinates[0];
      return lng >= -180 && lng <= 180;
    });

    if (!validAirports.length) return;

    const bounds = L.latLngBounds(
      validAirports.map(a => L.latLng(a.geometry.coordinates[1], a.geometry.coordinates[0]))
    );

    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [15, 15], duration: 0.75 });
    }
  }, [airportsForMarkers, map]);

  if (!routeFeatures.length) return null;

  return (
    <FeatureGroup ref={groupRef}>
      {/* Routes */}
      {routeFeatures.map((f, idx) => {
        const coords = f.geometry.coordinates;
        if (!coords || coords.length < 2) return null;
        const srcCoord = new L.LatLng(coords[0][1], coords[0][0]);
        const dstCoord = new L.LatLng(coords[1][1], coords[1][0]);

        return (
          <ArcLine
            key={`${f.properties.src_airport}-${f.properties.dst_airport}-${f.properties.airline_code}-${idx}`}
            src={srcCoord}
            dst={dstCoord}
            onClick={() => setSelectedRoute(f.properties, routeFeatures, airports)}
          />
        );
      })}

      {/* Airports */}
      <AirportMarkers airports={airportsForMarkers} onSelectAirport={onSelectAirport} />
    </FeatureGroup>
  );
};

export default RouteLayer;
