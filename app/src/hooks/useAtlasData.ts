import { useEffect, useState } from "react";
import { fetchAirlines, fetchAirports } from "@/services/api";
import type { Airlines, Airport, MonthOption } from "@/types";

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** `undefined` waits for the snapshot list; `null` asks for the newest snapshot. */
export const useAtlasData = (snapshot: MonthOption | null | undefined) => {
  const [airlines, setAirlines] = useState<Airlines>({});
  const [airports, setAirports] = useState<Airport[]>([]);
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

  const key = snapshot === undefined ? null : `${snapshot?.year}-${snapshot?.month}`;

  useEffect(() => {
    if (snapshot === undefined) return;
    let cancelled = false;
    fetchAirports(snapshot)
      .then((data) => !cancelled && setAirports(data))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
    // The key holds everything the request uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { airports, airlines, error };
};
