import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Airport, Compare, MonthOption, Routes } from "@/types";
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

const month = (n: number): MonthOption => ({
  label: `${["August", "September", "October"][n - 8]} 2026`,
  month: String(n).padStart(2, "0"),
  year: 2026,
});
const MONTHS = [month(10), month(9), month(8)];

const setup = (selection: {
  airport?: Airport;
  destination?: Airport;
  airline?: string;
  routes?: Routes;
  months?: MonthOption[];
  compare?: Compare;
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
    monthOptions: selection.months ?? [],
    snapshot: selection.months?.[0] ?? null,
    setSnapshot: vi.fn(),
    compare: selection.compare ?? null,
    setCompare: vi.fn(),
    changeCount: selection.compare ? 2 : null,
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

  it("can't compare with only one month", async () => {
    setup({ months: [month(10)] });
    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByRole("checkbox", { name: "Compare months" })).toBeDisabled();
  });

  it("compares with the month before by default", async () => {
    const props = setup({ months: MONTHS });
    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Compare months" }));
    expect(props.setCompare).toHaveBeenCalledWith({ from: MONTHS[1], show: "added" });
  });

  it("offers only earlier months and switches to lost routes", async () => {
    const compare: Compare = { from: MONTHS[1], show: "added" };
    const props = setup({ months: MONTHS, compare });
    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
    await userEvent.click(screen.getByRole("combobox", { name: "From month" }));
    expect(screen.getByRole("option", { name: "Aug 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Oct 2026" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Lost routes" }));
    expect(props.setCompare).toHaveBeenCalledWith({ ...compare, show: "lost" });
  });
});
