import type { Feature, FeatureCollection, LineString, Point } from "geojson";

export type AirportProperties = {
  FAA: string | null;
  IATA: string;
  Name: string;
  City?: string | null;
  url: string;
  destinations: number;
};

export type Airport = Feature<Point, AirportProperties>;

/** Seasonal, charter, or seasonal charter service. Year-round scheduled service has none. */
export type Service = "s" | "c" | "sc";

export type RouteProperties = {
  airline_code: string;
  src_airport: string;
  dst_airport: string;
  service?: Service;
};

export type Routes = FeatureCollection<LineString, RouteProperties>;

/** One airline's route in one direction: the app's working form of a `RoutePair`. */
export type RouteRow = [
  airline_code: string,
  src_airport: string,
  dst_airport: string,
  service?: Service,
];

/** A routes.json row: the airlines one airport lists to another. A code ends in `:s`, `:c` or `:sc` for seasonal or charter service. */
export type RoutePair = [src_airport: string, dst_airport: string, airline_codes: string[]];

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

export type RouteChange = "added" | "lost";

/** Compares `from` with the later month the map shows. */
export type Compare = { from: MonthOption; show: RouteChange };
