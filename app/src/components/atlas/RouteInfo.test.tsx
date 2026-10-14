import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Airport, Routes } from "@/types";
import { RouteInfo } from "./RouteInfo";

const airport = (IATA: string, Name: string): Airport => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [0, 0] },
  properties: {
    FAA: IATA,
    IATA,
    Name,
    url: `https://en.wikipedia.org/wiki/${IATA}`,
    destinations: 1,
  },
});

const route = (airline_code: string, src_airport: string, dst_airport: string) => ({
  type: "Feature" as const,
  geometry: { type: "LineString" as const, coordinates: [] },
  properties: { airline_code, src_airport, dst_airport },
});

const ROUTES: Routes = {
  type: "FeatureCollection",
  features: [
    route("DL", "ATL", "BOS"),
    route("DL", "ATL", "BOS"),
    route("B6", "ATL", "BOS"),
    route("UA", "ATL", "ORD"),
  ],
};

describe("RouteInfo", () => {
  it("lists each airline on the route once, linked to Google Flights", () => {
    render(
      <RouteInfo
        selectedAirport={airport("ATL", "Atlanta")}
        destinationAirport={airport("BOS", "Boston")}
        routes={ROUTES}
        airlines={{ DL: "Delta Air Lines", B6: "JetBlue" }}
        onClose={() => {}}
      />,
    );

    const flights = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("href")?.includes("google.com"));
    expect(flights).toHaveLength(2);
    expect(flights[0]).toHaveAccessibleName("Delta Air Lines (opens in a new tab)");
    expect(flights[0]).toHaveAttribute(
      "href",
      "https://www.google.com/travel/flights?q=ATL+to+BOS+DL",
    );
    expect(flights[1]).toHaveAccessibleName("JetBlue (opens in a new tab)");
  });

  it("closes through onClose", async () => {
    const handleBack = vi.fn();
    render(
      <RouteInfo
        selectedAirport={airport("ATL", "Atlanta")}
        destinationAirport={airport("BOS", "Boston")}
        routes={ROUTES}
        airlines={{}}
        onClose={handleBack}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close route" }));
    expect(handleBack).toHaveBeenCalledOnce();
  });
});
