import { useEffect, useState } from "react";

export const useFilteredAirlines = (allRoutes, airlines) => {
  const [filteredAirlines, setFilteredAirlines] = useState([]);

  useEffect(() => {
    if (!allRoutes || !airlines.length) {
      // Reset when no routes are selected
      setFilteredAirlines([]);
      return;
    }

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

  return filteredAirlines;
};
