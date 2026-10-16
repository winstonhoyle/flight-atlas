import type { Feature, FeatureCollection, LineString, Point } from "geojson";

export type AirportProperties = {
  FAA: string | null;
  IATA: string;
  Name: string;
  url: string;
  destinations: number;
};

export type Airport = Feature<Point, AirportProperties>;

export type RouteProperties = {
  airline_code: string;
  src_airport: string;
  dst_airport: string;
};

export type Routes = FeatureCollection<LineString, RouteProperties>;

export type RouteRow = [airline_code: string, src_airport: string, dst_airport: string];

export type Airlines = Record<string, string>;

export type AirlineSummary = {
  code: string;
  name: string;
  destinations?: number;
};

export type ProblemKind =
  | "destinations_table"
  | "destination_page"
  | "airline_code"
  | "airline_link"
  | "airport_page"
  | "coordinates"
  | "one_sided_route";

/** A Wikipedia page the scraper couldn't fully read. `airport` is whose data it affects. */
export type Problem = {
  kind: ProblemKind;
  airport: string | null;
  airport_name: string | null;
  airline: string | null;
  url: string | null;
  message: string;
  coordinates: [number, number] | null;
};

export type MonthOption = {
  label: string;
  /** Zero-padded, e.g. "09" */
  month: string;
  year: number;
};
