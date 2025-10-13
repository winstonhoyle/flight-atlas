import { useState, useEffect, useRef } from "react";
import { fetchRoutes } from "../services/api";

/**
 * Custom React hook to fetch flight routes.
 * Fetches routes based on either:
 *  - a selected airport (returns all routes from/to that airport), or
 *  - a selected airline (returns all routes operated by that airline).
 *
 * Returns both the current `routes` (which can be filtered)
 * and `allRoutes` (the full dataset), along with loading and error state.
 */
export const useRoutes = (selectedAirport, selectedAirline) => {
  // -------------------------
  // Local state
  // -------------------------
  const [routes, setRoutes] = useState(null);        // filtered routes shown on map
  const [allRoutes, setAllRoutes] = useState(null);  // all fetched routes (unfiltered)
  const [loading, setLoading] = useState(false);     // loading spinner indicator
  const [error, setError] = useState(null);          // error message if fetch fails

  // Store reference to AbortController so we can cancel ongoing fetches
  const abortControllerRef = useRef(null);

  useEffect(() => {
    // -------------------------
    // Guard clause: nothing selected
    // -------------------------
    // If neither an airport nor an airline is selected, clear routes and return early.
    if (!selectedAirport && !selectedAirline) {
      setAllRoutes(null);
      setRoutes(null);
      return;
    }

    // -------------------------
    // Async fetch function
    // -------------------------
    const loadRoutes = async () => {
      setLoading(true);
      setError(null);

      // Cancel any previous request before starting a new one
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        let data = null;

        if (selectedAirport) {

          // Fetch routes for a specific airport using its IATA code
          const iata = selectedAirport.properties.IATA;
          data = await fetchRoutes({ airportIata: iata }, controller.signal);
        } else if (selectedAirline) {

          // Fetch routes for a specific airline using its code
          data = await fetchRoutes({ airlineCode: selectedAirline }, controller.signal);
        }

        // If API returned nothing (null or empty)
        if (!data || !data.features) {
          setError("No routes found or server unavailable");
          return;
        }

        // Ensure data is in GeoJSON FeatureCollection format
        const geojson = data.features ? data : { type: "FeatureCollection", features: data };

        // Save both full and filtered copies of route data
        setAllRoutes(geojson);
        setRoutes(geojson);
      } catch (err) {

        // Ignore abort errors (triggered by fast user switching)
        if (err.name !== "AbortError") setError("Failed to load routes");
      } finally {

        // Stop loading spinner
        setLoading(false);
      }
    };

    // Trigger the fetch
    loadRoutes();

    // Cleanup: abort ongoing fetch when component unmounts or dependencies change
    return () => abortControllerRef.current?.abort();

  }, [selectedAirport, selectedAirline]); // re-run whenever either selection changes

  return { routes, allRoutes, setRoutes, setAllRoutes, loading, error };
};
