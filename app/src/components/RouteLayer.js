import React, { useEffect, useRef, useMemo } from "react";
import { FeatureGroup } from "react-leaflet";
import L from "leaflet";
import ArcLine from "./ArcLine";
import AirportMarkers from "./AirportMarkers";

import { useFlightAtlasStore } from "../store/useFlightAtlasStore";


/**
 * RouteLayer Component
 *
 * Renders a set of Leaflet CircleMarker with Geodesic lines.
 * Each marker's size and color are determined by the number of destinations from that airport.
 * Provides interactivity:
 *   - Click to select an airport
 *   - Hover to show a popup and highlight connected routes
 *
 * Props:
 * - routes: GeoJSON Object of routes sometimes filtered sometimes all routes
 * - setSelectedRoute: function to update selectedRoute state
 * - selectedAirport: GeoJSON Object of the selected airport
 * - onSelectAirport: function to run code when the airport is selected, it will cause a rerender of this component
 * - highlightedAirport: GeoJSON airport object of a highlighted Airport
 * - setHighlightedAirport: function to update highlighted airport state
 */
const RouteLayer = ({ routes, setSelectedRoute, selectedAirport, onSelectAirport, highlightedAirport, setHighlightedAirport }) => {

  const groupRef = useRef();

  // Memoize routeFeatures to make it stable for Hooks
  const routeFeatures = useMemo(
    () => routes?.features || [],
    [routes?.features]
  );

  // Get airports from store
  const { airports, loaded, initData } = useFlightAtlasStore();

  useEffect(() => {
    if (!loaded) initData();
  }, [loaded, initData]);

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
            color={
              highlightedAirport &&
                (highlightedAirport !== selectedAirport) &&
                routeFeatures
                ? "#cce7f8ff"
                : "#64b5f7ff"
            }
            weight={highlightedAirport &&
              (highlightedAirport !== selectedAirport) &&
              routeFeatures
              ? 1.0
              : 2.0
            }
            onClick={() => {
              setSelectedRoute(f)
            }
            }
            interactive={true}
          />
        );
      })}

      {/* Highlighted routes for hovered airport */}
      {highlightedAirport && (highlightedAirport !== selectedAirport) &&
        routeFeatures
          .filter(f =>
            f.properties.src_airport === highlightedAirport.properties.IATA ||
            f.properties.dst_airport === highlightedAirport.properties.IATA
          )

          .map((f, idx) => {
            const coords = f.geometry.coordinates;
            if (!coords || coords.length < 2) return null;
            const srcCoord = new L.LatLng(coords[0][1], coords[0][0]);
            const dstCoord = new L.LatLng(coords[1][1], coords[1][0]);

            return (
              <ArcLine
                key={`highlight-${f.properties.src_airport}-${f.properties.dst_airport}-${f.properties.airline_code}-${idx}`}
                src={srcCoord}
                dst={dstCoord}
                color="#02508fff"
                weight={3.0}
                opacity={1.0}
                interactive={false}
              />
            );
          })}

      {/* Render all airports as markers */}
      <AirportMarkers
        airports={airportsForMarkers}
        onSelectAirport={onSelectAirport}
        highlightedAirport={highlightedAirport}
        setHighlightedAirport={setHighlightedAirport}
        interactive={false}
      />

      {/* Invisible markers but larger radius */}
      <AirportMarkers
        airports={airportsForMarkers}
        onSelectAirport={onSelectAirport}
        highlightedAirport={highlightedAirport}
        setHighlightedAirport={setHighlightedAirport}
        radius={15}
        opacity={0.0}
        stroke={false}
        interactive={true}
      />
    </FeatureGroup>
  );
};

export default RouteLayer;
