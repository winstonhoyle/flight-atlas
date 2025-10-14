import React, { useEffect, useRef, useMemo } from "react";
import { useMap, FeatureGroup } from "react-leaflet";
import L from "leaflet";
import ArcLine from "./ArcLine";
import AirportMarkers from "./AirportMarkers";

/**
 * RouteLayer Component
 *
 * Displays routes and airports on a Leaflet map.
 * Handles antimeridian wrapping and fits map bounds.
 *
 * Props:
 * - routes: GeoJSON FeatureCollection of LineStrings representing flight routes.
 * - setSelectedRoute: function(properties, allRoutes, allAirports)
 *      Sets the currently selected route. Called when an ArcLine is clicked.
 * - onSelectAirport: function(airport)
 *      Sets the currently selected airport (used by AirportMarkers).
 */
const RouteLayer = ({ routes, setSelectedRoute, onSelectAirport }) => {
  const map = useMap();
  const groupRef = useRef();

  // Memoize routeFeatures to make it stable for Hooks
  const routeFeatures = useMemo(() => routes?.features || [], [routes?.features]);

  // Memoize airports from localStorage (GeoJSON Points)
  const airports = useMemo(() => JSON.parse(localStorage.getItem("airports")) || [], []);

  // Map airport IATA code -> airport object for quick lookup
  const airportsMap = useMemo(() => new Map(airports.map(a => [a.properties.IATA, a])), [airports]);

  // Build a Set of all airports used in the routes
  const airportSet = useMemo(() => {
    const set = new Set();
    routeFeatures.forEach(f => {
      set.add(f.properties.src_airport);
      set.add(f.properties.dst_airport);
    });
    return set;
  }, [routeFeatures]);

  /**
  * Build list of airports for markers
  * - Includes duplicates if route crosses the antimeridian
  * - Ensures markers appear correctly on map (±360° shifts)
  */
  const airportsForMarkers = useMemo(() => {
    const result = [];

    airportSet.forEach(code => {
      const airport = airportsMap.get(code);
      if (!airport) return;

      const [lng, lat] = airport.geometry.coordinates;

      // Base marker
      result.push({ ...airport, geometry: { coordinates: [lng, lat] } });

      // Check if any route for this airport crosses the antimeridian
      const crossesAntimeridian = routeFeatures.some(f => {
        const srcLng = f.geometry.coordinates[0][0];
        const dstLng = f.geometry.coordinates[1][0];
        return (f.properties.src_airport === code || f.properties.dst_airport === code)
          ? Math.abs(dstLng - srcLng) > 180
          : false;
      });

      if (crossesAntimeridian) {
        // Duplicate markers shifted ±360° longitude
        result.push({ ...airport, geometry: { coordinates: [lng + 360, lat] } });
        result.push({ ...airport, geometry: { coordinates: [lng - 360, lat] } });
      }
    });

    return result;
  }, [airportSet, airportsMap, routeFeatures]);

  /**
   * Fit map bounds to only valid markers (longitude between -180 and 180)
   * This avoids flying to duplicate antimeridian-shifted points outside view
   */
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

  // If there are no routes, render nothing
  if (!routeFeatures.length) return null;

  return (
    <FeatureGroup ref={groupRef}>
      {/* Render all routes as ArcLine components */}
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
            onClick={() => {
              setSelectedRoute(f)
            }
            }
          />
        );
      })}

      {/* Render all airports as markers */}
      <AirportMarkers airports={airportsForMarkers} onSelectAirport={onSelectAirport} />
    </FeatureGroup>
  );
};

export default RouteLayer;
