// hooks/useFilteredRoutes.js
import { useEffect } from "react";

export const useFilteredRoutes = (allRoutes, selectedAirline, setRoutes) => {
  useEffect(() => {
    if (!allRoutes) return;

    const filtered = selectedAirline
      ? { ...allRoutes, features: allRoutes.features.filter(f => f.properties.airline_code === selectedAirline) }
      : allRoutes;

    setRoutes(filtered);
  }, [allRoutes, selectedAirline, setRoutes]);
};
