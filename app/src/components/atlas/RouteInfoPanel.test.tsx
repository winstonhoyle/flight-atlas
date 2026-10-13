import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Airport, Routes } from "@/types";
import { RouteInfoPanel } from "./RouteInfoPanel";

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

describe("RouteInfoPanel", () => {
  it("lists each airline on the route once, linked to Google Flights", () => {
    render(
      <RouteInfoPanel
        selectedAirport={airport("ATL", "Atlanta")}
        destinationAirport={airport("BOS", "Boston")}
        routes={ROUTES}
        airlines={{ DL: "Delta Air Lines", B6: "JetBlue" }}
        handleBack={() => {}}
      />,
    );

    const links = screen.getAllByRole("link", { name: /flights|Delta|JetBlue/ });
    expect(links.map((l) => l.textContent)).toEqual([
      "DL · Delta Air Lines (opens in a new tab)",
      "B6 · JetBlue (opens in a new tab)",
    ]);
    expect(links[0]).toHaveAttribute(
      "href",
      "https://www.google.com/travel/flights?q=ATL+to+BOS+DL",
    );
  });

  it("closes through handleBack", async () => {
    const handleBack = vi.fn();
    render(
      <RouteInfoPanel
        selectedAirport={airport("ATL", "Atlanta")}
        destinationAirport={airport("BOS", "Boston")}
        routes={ROUTES}
        airlines={{}}
        handleBack={handleBack}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close route info" }));
    expect(handleBack).toHaveBeenCalledOnce();
  });
});
