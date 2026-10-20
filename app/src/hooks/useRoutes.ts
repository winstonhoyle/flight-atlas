import { useMemo } from "react";
import type { AirlineSummary, Airlines, Airport, RouteRow, Routes } from "@/types";

/**
 * An airport's routes leave from it, even with an airline chosen; the map filters those by airline.
 * `all` draws every row when nothing is selected, for the short lists of changed routes.
 */
export const routesFor = (
  selectedAirport: Airport | null,
  selectedAirline: string,
  rows: RouteRow[] | null,
  airports: Airport[],
  all = false,
): Routes | null => {
  const iata = selectedAirport?.properties.IATA;
  if (!rows || (!iata && !selectedAirline && !all)) return null;
  const coordinates = new Map(airports.map((a) => [a.properties.IATA, a.geometry.coordinates]));
  const features: Routes["features"] = [];
  for (const [airline_code, src_airport, dst_airport] of rows) {
    if (iata ? src_airport !== iata : selectedAirline && airline_code !== selectedAirline) continue;
    const src = coordinates.get(src_airport);
    const dst = coordinates.get(dst_airport);
    if (!src || !dst) continue;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [src, dst] },
      properties: { airline_code, src_airport, dst_airport },
    });
  }
  return { type: "FeatureCollection", features };
};

/** The airlines on these routes, most destinations first. */
export const airlinesOn = (routes: Routes, airlines: Airlines): AirlineSummary[] => {
  const destinations = new Map<string, Set<string>>();
  for (const { properties: p } of routes.features) {
    if (!destinations.has(p.airline_code)) destinations.set(p.airline_code, new Set());
    destinations.get(p.airline_code)!.add(p.dst_airport);
  }
  return [...destinations]
    .map(([code, dsts]) => ({
      code,
      name: airlines[code] || "Unknown Airline",
      destinations: dsts.size,
    }))
    .sort((a, b) => b.destinations - a.destinations);
};

export const useRoutes = (
  selectedAirport: Airport | null,
  selectedAirline: string,
  rows: RouteRow[] | null,
  airports: Airport[],
  all = false,
) =>
  useMemo(
    () => routesFor(selectedAirport, selectedAirline, rows, airports, all),
    [selectedAirport, selectedAirline, rows, airports, all],
  );
