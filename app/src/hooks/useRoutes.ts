import { useEffect, useState } from "react";
import { fetchRoutes } from "@/services/api";
import type { Airport, Routes } from "@/types";

type Result = { key: string; routes: Routes | null; error: string | null };

/**
 * Loads routes for the selected airport, or else the selected airline. With both
 * selected, the airport's routes are kept and the map filters them by airline.
 */
export const useRoutes = (
  selectedAirport: Airport | null,
  selectedAirline: string,
  selectedMonth: string,
) => {
  const [result, setResult] = useState<Result | null>(null);

  const airportIata = selectedAirport?.properties.IATA;
  const key = airportIata
    ? `airport:${airportIata}:${selectedMonth}`
    : selectedAirline
      ? `airline:${selectedAirline}:${selectedMonth}`
      : null;

  useEffect(() => {
    if (!key) return;

    const controller = new AbortController();
    const query = airportIata
      ? { airportIata, month: selectedMonth }
      : { airlineCode: selectedAirline, month: selectedMonth };

    fetchRoutes(query, controller.signal)
      .then((routes) =>
        setResult({
          key,
          routes,
          error: routes ? null : "No routes found or server unavailable",
        }),
      )
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({ key, routes: null, error: "Failed to load routes" });
        }
      });

    return () => controller.abort();
    // The key encodes every input the query uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = key && result?.key === key ? result : null;
  return {
    routes: current?.routes ?? null,
    loading: key !== null && !current,
    error: current?.error ?? null,
  };
};
