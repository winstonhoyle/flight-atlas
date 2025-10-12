import { useState, useEffect, useRef } from "react";
import { fetchRoutes } from "../services/api";

export const useRoutes = (selectedAirport) => {
  const [routes, setRoutes] = useState(null);
  const [allRoutes, setAllRoutes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

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
        const geojson = data.features ? data : { type: "FeatureCollection", features: data };
        setAllRoutes(geojson);
        setRoutes(geojson);
      } catch (err) {
        if (err.name !== "AbortError") setError("Failed to load routes");
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();

    return () => abortControllerRef.current?.abort();
  }, [selectedAirport]);

  return { routes, allRoutes, setRoutes, setAllRoutes, loading, error };
};
