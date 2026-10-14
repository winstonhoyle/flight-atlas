import type { Airlines, Airport, MonthOption, Routes } from "@/types";

export const API_BASE = import.meta.env.VITE_API_BASE || "https://api.flightatlas.io";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** No snapshot asks the API for the newest one. */
export const snapshotParams = (snapshot: MonthOption | null): URLSearchParams =>
  new URLSearchParams(snapshot ? { year: String(snapshot.year), month: snapshot.month } : {});

const withQuery = (path: string, params: URLSearchParams) => {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJSON = async (endpoint: string, signal?: AbortSignal): Promise<unknown> => {
  const res = await fetch(`${API_BASE}${endpoint}`, { signal });
  if (!res.ok) throw new Error(`HTTP error ${res.status} on ${endpoint}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const isObject = (data: unknown): data is Record<string, unknown> =>
  typeof data === "object" && data !== null && !Array.isArray(data);

const isAirlines = (data: unknown): data is Airlines =>
  isObject(data) && Object.values(data).every((v) => typeof v === "string");

const isFeatureCollection = (data: unknown): data is { features: unknown[] } =>
  isObject(data) && data.type === "FeatureCollection" && Array.isArray(data.features);

const isMonthRows = (data: unknown): data is { month: string; year: string }[] =>
  Array.isArray(data) &&
  data.every((d) => isObject(d) && typeof d.month === "string" && typeof d.year === "string");

const retryFetch = async <T>(
  fetchFn: () => Promise<unknown>,
  isValid: (data: unknown) => data is T,
  maxAttempts = 5,
  delay = 500,
  signal?: AbortSignal,
): Promise<T> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await fetchFn();
      if (isValid(data)) return data;
      console.warn(`Attempt ${attempt + 1}: response failed schema validation.`);
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn(`Attempt ${attempt + 1} failed: ${errorMessage(err)}`);
    }
    if (attempt < maxAttempts - 1) await sleep(delay);
  }
  throw new Error("Exceeded maximum attempts with invalid schema.");
};

export const fetchAirlines = async (): Promise<Airlines> => {
  const data = await retryFetch(() => fetchJSON("/airlines"), isAirlines);

  const cleaned: Airlines = {};
  for (const [code, name] of Object.entries(data)) {
    cleaned[code] = name.replace(/[\r\n]+/g, " ").trim();
  }
  return cleaned;
};

export const fetchAirports = async (snapshot: MonthOption | null): Promise<Airport[]> => {
  const path = withQuery("/airports", snapshotParams(snapshot));
  const data = await retryFetch(() => fetchJSON(path), isFeatureCollection);
  return data.features as Airport[];
};

type RouteQuery = {
  airportIata?: string;
  airlineCode?: string;
  snapshot: MonthOption | null;
};

/** Returns null if the query never finishes; throws only when `signal` aborts. */
export const fetchRoutes = async (
  { airportIata, airlineCode, snapshot }: RouteQuery,
  signal?: AbortSignal,
): Promise<Routes | null> => {
  const params = snapshotParams(snapshot);
  if (airportIata) params.set("airport", airportIata);
  if (airlineCode) params.set("airline_code", airlineCode);
  const url = withQuery("/routes", params);
  try {
    return (await retryFetch(
      () => fetchJSON(url, signal),
      isFeatureCollection,
      10,
      500,
      signal,
    )) as Routes;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn(`fetchRoutes: no result for ${url}`);
    return null;
  }
};

export const fetchMonths = async (): Promise<MonthOption[]> => {
  const data = await retryFetch(() => fetchJSON("/available_months"), isMonthRows);

  return data
    .map(({ month, year }) => ({
      label: `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`,
      month: month.padStart(2, "0"),
      year: parseInt(year, 10),
    }))
    .sort((a, b) => b.year - a.year || parseInt(b.month, 10) - parseInt(a.month, 10));
};
