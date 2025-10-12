import { useState, useEffect } from "react";
import { fetchAirports, fetchAirlines } from "../services/api";

export function useAirportsAndAirlines() {
  const [airports, setAirports] = useState([]);
  const [airlines, setAirlines] = useState([]);

  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Airports with monthly cache
    const cachedAirports = localStorage.getItem("airports");
    const cachedAirportsMonth = localStorage.getItem("airports_month");
    if (cachedAirports && cachedAirportsMonth === currentMonth) {
      setAirports(JSON.parse(cachedAirports));
    } else {
      fetchAirports().then(data => {
        setAirports(data);
        localStorage.setItem("airports", JSON.stringify(data));
        localStorage.setItem("airports_month", currentMonth);
      });
    }

    // Airlines with monthly cache
    const cachedAirlines = localStorage.getItem("airlines");
    const cachedAirlinesMonth = localStorage.getItem("airlines_month");
    if (cachedAirlines && cachedAirlinesMonth === currentMonth) {
      setAirlines(JSON.parse(cachedAirlines));
    } else {
      fetchAirlines().then(data => {
        setAirlines(data);
        localStorage.setItem("airlines", JSON.stringify(data));
        localStorage.setItem("airlines_month", currentMonth);
      });
    }
  }, []);

  return { airports, airlines };
}
