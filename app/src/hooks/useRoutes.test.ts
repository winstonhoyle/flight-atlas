import { describe, expect, it } from "vitest";
import type { Airport, RouteRow } from "@/types";
import { routesFor } from "./useRoutes";

const airport = (IATA: string, lng: number, lat: number): Airport => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { FAA: null, IATA, Name: IATA, url: "", destinations: 0 },
});

const AIRPORTS = [
  airport("ATL", -84.4, 33.6),
  airport("BOS", -71, 42.4),
  airport("JFK", -73.8, 40.6),
];
const ROWS: RouteRow[] = [
  ["DL", "ATL", "BOS"],
  ["B6", "ATL", "JFK"],
  ["DL", "BOS", "ATL"],
  ["DL", "ATL", "XXX"],
];
const pairs = (routes: ReturnType<typeof routesFor>) =>
  routes?.features.map(
    ({ properties: p }) => `${p.airline_code} ${p.src_airport}-${p.dst_airport}`,
  );

describe("routesFor", () => {
  it("keeps an airport's departures from every airline, skipping unknown airports", () => {
    expect(pairs(routesFor(AIRPORTS[0], "DL", ROWS, AIRPORTS))).toEqual([
      "DL ATL-BOS",
      "B6 ATL-JFK",
    ]);
  });

  it("keeps an airline's routes in both directions", () => {
    expect(pairs(routesFor(null, "DL", ROWS, AIRPORTS))).toEqual(["DL ATL-BOS", "DL BOS-ATL"]);
  });

  it("draws lines between the airports' coordinates", () => {
    const routes = routesFor(null, "B6", ROWS, AIRPORTS);
    expect(routes?.features[0].geometry.coordinates).toEqual([
      [-84.4, 33.6],
      [-73.8, 40.6],
    ]);
  });

  it("has nothing to show without a selection or data", () => {
    expect(routesFor(null, "", ROWS, AIRPORTS)).toBeNull();
    expect(routesFor(AIRPORTS[0], "", null, AIRPORTS)).toBeNull();
  });
});
