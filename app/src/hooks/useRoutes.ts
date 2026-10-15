import { useMemo } from "react";
import type { Airport, RouteRow, Routes } from "@/types";

/** An airport's routes leave from it, even with an airline chosen; the map filters those by airline. */
export const routesFor = (
  selectedAirport: Airport | null,
  selectedAirline: string,
  rows: RouteRow[] | null,
  airports: Airport[],
): Routes | null => {
  const iata = selectedAirport?.properties.IATA;
  if (!rows || (!iata && !selectedAirline)) return null;
  const coordinates = new Map(airports.map((a) => [a.properties.IATA, a.geometry.coordinates]));
  const features: Routes["features"] = [];
  for (const [airline_code, src_airport, dst_airport] of rows) {
    if (iata ? src_airport !== iata : airline_code !== selectedAirline) continue;
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

export const useRoutes = (
  selectedAirport: Airport | null,
  selectedAirline: string,
  rows: RouteRow[] | null,
  airports: Airport[],
) =>
  useMemo(
    () => routesFor(selectedAirport, selectedAirline, rows, airports),
    [selectedAirport, selectedAirline, rows, airports],
  );
