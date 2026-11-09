import { tagOf } from "@/i18n/translate";
import { isService } from "@/utils/service";
import type { Airlines, Airport, MonthOption, Problem, RoutePair, RouteRow } from "@/types";

export const API_BASE = import.meta.env.VITE_API_BASE || "https://api.flightatlas.io";

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
  ifMissing?: T,
): Promise<T> => {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (res.status === 404 && ifMissing !== undefined) return ifMissing;
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

const isRoutePairs = (data: unknown): data is RoutePair[] =>
  Array.isArray(data) &&
  data.every(
    (r) =>
      Array.isArray(r) &&
      r.length === 3 &&
      typeof r[0] === "string" &&
      typeof r[1] === "string" &&
      Array.isArray(r[2]) &&
      r[2].every((c) => typeof c === "string"),
  );

const isProblems = (data: unknown): data is Problem[] =>
  Array.isArray(data) &&
  data.every((p) => isObject(p) && typeof p.kind === "string" && typeof p.message === "string");

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

/** A row per airline. A code's `:s`, `:c` or `:sc` marker becomes the row's service. */
export const legsOf = (pairs: RoutePair[]): RouteRow[] =>
  pairs.flatMap(([src, dst, codes]) =>
    codes.map((code): RouteRow => {
      const [airline, marker] = code.split(":");
      return isService(marker) ? [airline, src, dst, marker] : [airline, src, dst];
    }),
  );

const snapshotPath = (path: string, snapshot: MonthOption | null) =>
  withQuery(path, snapshotParams(snapshot));

export const fetchAirports = async (snapshot: MonthOption | null): Promise<Airport[]> => {
  const data = await fetchJSON(snapshotPath("/airports", snapshot), isFeatureCollection);
  return data.features as Airport[];
};

export const fetchRoutes = async (snapshot: MonthOption | null): Promise<RouteRow[]> =>
  legsOf(await fetchJSON(snapshotPath("/routes", snapshot), isRoutePairs));

// Months scraped before problems.json existed have none.
export const fetchProblems = (snapshot: MonthOption | null): Promise<Problem[]> =>
  fetchJSON(snapshotPath("/problems", snapshot), isProblems, []);

export const fetchMonths = async (): Promise<MonthOption[]> => {
  const data = await fetchJSON("/available_months", isMonthRows);
  const monthName = new Intl.DateTimeFormat(tagOf(window.location.pathname), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return data
    .map(({ month, year }) => ({
      label: monthName.format(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1)),
      month: month.padStart(2, "0"),
      year: parseInt(year, 10),
    }))
    .sort((a, b) => b.year - a.year || parseInt(b.month, 10) - parseInt(a.month, 10));
};
