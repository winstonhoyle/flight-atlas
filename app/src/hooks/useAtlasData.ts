import { useEffect, useState } from "react";
import { fetchAirlines, fetchAirports } from "@/services/api";
import type { Airlines, Airport } from "@/types";

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Airlines load once; airports reload per month, keeping the previous month's on screen meanwhile. */
export const useAtlasData = (month: string) => {
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

  useEffect(() => {
    let cancelled = false;
    fetchAirports(month)
      .then((data) => !cancelled && setAirports(data))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [month]);

  return { airports, airlines, error };
};
