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

export type Airlines = Record<string, string>;

export type AirlineSummary = {
  code: string;
  name: string;
  destinations?: number;
};

export type MonthOption = {
  label: string;
  /** Zero-padded, e.g. "09" */
  month: string;
  year: number;
};
