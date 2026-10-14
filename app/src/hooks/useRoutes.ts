import { useEffect, useState } from "react";
import { fetchRoutes } from "@/services/api";
import type { Airport, MonthOption, Routes } from "@/types";

type Result = { key: string; routes: Routes | null; error: string | null };

/** With both an airport and an airline selected, the map filters the airport's routes by airline. */
export const useRoutes = (
  selectedAirport: Airport | null,
  selectedAirline: string,
  snapshot: MonthOption | null | undefined,
) => {
  const [result, setResult] = useState<Result | null>(null);

  const airportIata = selectedAirport?.properties.IATA;
  const snapshotKey = `${snapshot?.year}-${snapshot?.month}`;
  const key =
    snapshot === undefined
      ? null
      : airportIata
        ? `airport:${airportIata}:${snapshotKey}`
        : selectedAirline
          ? `airline:${selectedAirline}:${snapshotKey}`
          : null;

  useEffect(() => {
    if (!key) return;

    const controller = new AbortController();
    const query = airportIata
      ? { airportIata, snapshot: snapshot ?? null }
      : { airlineCode: selectedAirline, snapshot: snapshot ?? null };

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
