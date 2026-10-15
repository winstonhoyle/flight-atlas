import { useEffect, useState } from "react";
import { fetchAirlines, fetchAirports, fetchRoutes } from "@/services/api";
import type { Airlines, Airport, MonthOption, RouteRow } from "@/types";

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

type Month = { key: string; airports: Airport[]; routes: RouteRow[] };

/** `null` asks for the newest snapshot. Keeps showing the previous month while the next one loads. */
export const useAtlasData = (snapshot: MonthOption | null) => {
  const [airlines, setAirlines] = useState<Airlines>({});
  const [month, setMonth] = useState<Month | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAirlines()
      .then((data) => !cancelled && setAirlines(data))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const key = snapshot ? `${snapshot.year}-${snapshot.month}` : "newest";

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAirports(snapshot), fetchRoutes(snapshot)])
      .then(([airports, routes]) => !cancelled && setMonth({ key, airports, routes }))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
    // The key holds everything the request uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    airports: month?.airports ?? [],
    routes: month?.routes ?? null,
    airlines,
    loading: month?.key !== key && !error,
    error,
  };
};
