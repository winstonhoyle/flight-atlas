import type { Airlines, Airport, MonthOption, RouteRow } from "@/types";

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

const fetchJSON = async <T>(
  endpoint: string,
  isValid: (data: unknown) => data is T,
): Promise<T> => {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`HTTP error ${res.status} on ${endpoint}`);
  const data: unknown = await res.json();
  if (!isValid(data)) throw new Error(`Unexpected response from ${endpoint}`);
  return data;
};

const isObject = (data: unknown): data is Record<string, unknown> =>
  typeof data === "object" && data !== null && !Array.isArray(data);

const isAirlines = (data: unknown): data is Airlines =>
  isObject(data) && Object.values(data).every((v) => typeof v === "string");

const isFeatureCollection = (data: unknown): data is { features: unknown[] } =>
  isObject(data) && data.type === "FeatureCollection" && Array.isArray(data.features);

const isRouteRows = (data: unknown): data is RouteRow[] =>
  Array.isArray(data) &&
  data.every((r) => Array.isArray(r) && r.length === 3 && r.every((c) => typeof c === "string"));

const isMonthRows = (data: unknown): data is { month: string; year: string }[] =>
  Array.isArray(data) &&
  data.every((d) => isObject(d) && typeof d.month === "string" && typeof d.year === "string");

export const fetchAirlines = async (): Promise<Airlines> => {
  const data = await fetchJSON("/airlines", isAirlines);

  const cleaned: Airlines = {};
  for (const [code, name] of Object.entries(data)) {
    cleaned[code] = name.replace(/[\r\n]+/g, " ").trim();
  }
  return cleaned;
};

const snapshotPath = (path: string, snapshot: MonthOption | null) =>
  withQuery(path, snapshotParams(snapshot));

export const fetchAirports = async (snapshot: MonthOption | null): Promise<Airport[]> => {
  const data = await fetchJSON(snapshotPath("/airports", snapshot), isFeatureCollection);
  return data.features as Airport[];
};

export const fetchRoutes = (snapshot: MonthOption | null): Promise<RouteRow[]> =>
  fetchJSON(snapshotPath("/routes", snapshot), isRouteRows);

export const fetchMonths = async (): Promise<MonthOption[]> => {
  const data = await fetchJSON("/available_months", isMonthRows);

  return data
    .map(({ month, year }) => ({
      label: `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`,
      month: month.padStart(2, "0"),
      year: parseInt(year, 10),
    }))
    .sort((a, b) => b.year - a.year || parseInt(b.month, 10) - parseInt(a.month, 10));
};
