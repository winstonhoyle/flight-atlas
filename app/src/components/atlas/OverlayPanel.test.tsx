import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Airport, Routes } from "@/types";
import { OverlayPanel } from "./OverlayPanel";

const airport = (IATA: string): Airport => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [0, 0] },
  properties: { FAA: IATA, IATA, Name: IATA, url: "", destinations: 1 },
});

const route = (airline_code: string, dst_airport: string): Routes["features"][number] => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: [] },
  properties: { airline_code, src_airport: "GSO", dst_airport },
});

const setup = (selection: {
  airport?: Airport;
  destination?: Airport;
  airline?: string;
  routes?: Routes;
}) => {
  const props = {
    airports: [airport("GSO"), airport("DCA"), airport("ORD")],
    selectedAirport: selection.airport ?? null,
    destinationAirport: selection.destination ?? null,
    selectedAirline: selection.airline ?? "",
    filteredAirlines: [{ code: "AA", name: "American Airlines", destinations: 1 }],
    setSelectedAirport: vi.fn(),
    setDestinationAirport: vi.fn(),
    setSelectedAirline: vi.fn(),
    handleBack: vi.fn(),
    routes: selection.routes ?? null,
    monthOptions: [],
    snapshot: null,
    setSnapshot: vi.fn(),
    loading: false,
    error: null,
  };
  render(<OverlayPanel {...props} />);
  return props;
};

const clear = async (label: string) => {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.keyboard("{Backspace}");
};

describe("OverlayPanel", () => {
  it("clearing the origin clears the whole selection", async () => {
    const props = setup({ airport: airport("GSO"), destination: airport("DCA") });
    await clear("Origin airport");
    expect(props.setSelectedAirport).toHaveBeenCalledWith(null);
    expect(props.setDestinationAirport).toHaveBeenCalledWith(null);
    expect(props.handleBack).not.toHaveBeenCalled();
  });

  it("clearing the airline keeps the airport", async () => {
    const props = setup({ airport: airport("GSO"), airline: "AA" });
    await clear("Airline");
    expect(props.setSelectedAirline).toHaveBeenCalledWith("");
    expect(props.setSelectedAirport).not.toHaveBeenCalled();
  });

  it("has nothing to clear on All airlines", async () => {
    const props = setup({ airport: airport("GSO") });
    await clear("Airline");
    expect(props.handleBack).not.toHaveBeenCalled();
    expect(props.setSelectedAirport).not.toHaveBeenCalled();
  });

  it("offers only the chosen airline's destinations", async () => {
    setup({
      airport: airport("GSO"),
      airline: "AA",
      routes: {
        type: "FeatureCollection",
        features: [route("AA", "DCA"), route("UA", "ORD")],
      },
    });
    await userEvent.click(screen.getByRole("combobox", { name: "Destination airport" }));
    expect(screen.getByRole("option", { name: "DCA (DCA)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "ORD (ORD)" })).not.toBeInTheDocument();
  });
});
