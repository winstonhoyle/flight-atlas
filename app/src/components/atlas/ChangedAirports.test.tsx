import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Airport } from "@/types";
import { ChangedAirports } from "./ChangedAirports";

const airport = (IATA: string, destinations: number): Airport => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [0, 0] },
  properties: { FAA: null, IATA, Name: `${IATA} Airport`, url: "", destinations },
});

describe("ChangedAirports", () => {
  it("lists up to the limit, signs counts, and selects on click", async () => {
    const onSelect = vi.fn();
    const airports = [airport("ATL", 3), airport("BOS", 1), airport("DEN", 1)];
    render(
      <ChangedAirports
        airports={airports}
        show="lost"
        routeCount={5}
        onSelect={onSelect}
        limit={2}
      />,
    );
    expect(screen.getByRole("heading", { name: "5 lost routes" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("1 more airport. Search above for one.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /ATL/ }));
    expect(onSelect).toHaveBeenCalledWith(airports[0]);
    expect(screen.getByRole("button", { name: /ATL/ })).toHaveTextContent("−3");
  });
});
