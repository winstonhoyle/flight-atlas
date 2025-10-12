import { useEffect, useState } from "react";

// Custom hook to filter airlines based on available routes
export const useFilteredAirlines = (allRoutes, airlines) => {

  // State to store the filtered list of airlines
  const [filteredAirlines, setFilteredAirlines] = useState([]);

  useEffect(() => {
    // If there are no routes or airlines, reset filteredAirlines to empty
    if (!allRoutes || !airlines.length) {
      setFilteredAirlines([]);
      return;
    }

    // Set to keep track of unique source-destination-airline combinations
    const seenRoutes = new Set();

    // Object to count the number of routes per airline
    const airlineCounts = {};

    // Loop through all route features
    allRoutes.features.forEach(f => {

      // Skip invalid routes
      const { airline_code, src_airport, dst_airport } = f.properties;

      // Create a unique key for this airline+route combination
      if (!airline_code || !src_airport || !dst_airport) return;
      const key = `${airline_code}_${src_airport}_${dst_airport}`;

      // Skip duplicates
      if (seenRoutes.has(key)) return;
      seenRoutes.add(key);

      // Increment the count for this airline
      airlineCounts[airline_code] = (airlineCounts[airline_code] || 0) + 1;
    });

    // Convert the counts object into an array of airline objects
    const uniqueAirlines = Object.entries(airlineCounts)
      .map(([code, count]) => {
        // Find airline name from the airlines array; fallback to code if not found
        const airline = airlines.find(a => a.code === code);
        const name = airline ? airline.name : code;

        return { code, name, count };
      })

      // Sort airlines descending by number of routes
      .sort((a, b) => b.count - a.count);

    // Update state with filtered and sorted airlines
    setFilteredAirlines(uniqueAirlines);
  }, [allRoutes, airlines]);

  // Return the filtered airlines array
  return filteredAirlines;
};
