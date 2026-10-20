import { useEffect, useState } from "react";
import { fetchAirlines, fetchAirports, fetchProblems, fetchRoutes } from "@/services/api";
import type { Airlines, Airport, MonthOption, Problem, RouteRow } from "@/types";

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

type Month = { key: string; airports: Airport[]; routes: RouteRow[]; problems: Problem[] };

/** `null` asks for the newest snapshot. Keeps showing the previous month while the next one loads. */
const useMonthData = (snapshot: MonthOption | null, enabled = true) => {
  const [month, setMonth] = useState<Month | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = snapshot ? `${snapshot.year}-${snapshot.month}` : "newest";

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all([
      fetchAirports(snapshot),
      fetchRoutes(snapshot),
      // The map works without the problems report.
      fetchProblems(snapshot).catch(() => []),
    ])
      .then(
        ([airports, routes, problems]) =>
          !cancelled && setMonth({ key, airports, routes, problems }),
      )
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
    // The key holds everything the request uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const current = enabled && month?.key === key ? month : null;
  return {
    month: enabled ? month : null,
    current,
    loading: enabled && !current && !error,
    error: enabled ? error : null,
  };
};

export const useAtlasData = (snapshot: MonthOption | null) => {
  const [airlines, setAirlines] = useState<Airlines>({});
  const [airlinesError, setAirlinesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAirlines()
      .then((data) => !cancelled && setAirlines(data))
      .catch((err: unknown) => !cancelled && setAirlinesError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const { month, loading, error } = useMonthData(snapshot);

  return {
    airports: month?.airports ?? [],
    routes: month?.routes ?? null,
    problems: month?.problems ?? [],
    airlines,
    loading,
    error: airlinesError || error,
  };
};

/** The earlier month of a comparison. `null` loads nothing. Only the month asked for, never a stale one. */
export const useCompareData = (snapshot: MonthOption | null) => {
  const { current, loading, error } = useMonthData(snapshot, snapshot !== null);
  return {
    airports: current?.airports ?? [],
    routes: current?.routes ?? null,
    problems: current?.problems ?? [],
    loading,
    error,
  };
};
