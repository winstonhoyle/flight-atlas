import { describe, expect, it } from "vitest";
import type { Airport, Problem, RouteRow } from "@/types";
import { changedAirports, changeProblems, routeChanges } from "./routeChanges";

const airport = (IATA: string, destinations = 50): Airport => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [0, 0] },
  properties: { FAA: null, IATA, Name: IATA, url: "", destinations },
});

const problem = (airport: string | null): Problem => ({
  kind: "destinations_table",
  airport,
  airport_name: airport,
  airline: null,
  url: null,
  message: "",
  coordinates: null,
});

describe("routeChanges", () => {
  const from: RouteRow[] = [
    ["DL", "ATL", "BOS"],
    ["AA", "ATL", "JFK"],
    ["UA", "DEN", "ORD"],
  ];
  const to: RouteRow[] = [
    ["DL", "ATL", "BOS"],
    ["B6", "ATL", "JFK"],
    ["WN", "DEN", "AUS"],
    ["WN", "DEN", "AUS"],
  ];

  it("finds added and lost routes, once each", () => {
    expect(routeChanges(from, to)).toEqual({
      added: [
        ["B6", "ATL", "JFK"],
        ["WN", "DEN", "AUS"],
      ],
      lost: [
        ["AA", "ATL", "JFK"],
        ["UA", "DEN", "ORD"],
      ],
    });
  });

  it("has no changes between identical months", () => {
    expect(routeChanges(from, from)).toEqual({ added: [], lost: [] });
  });
});

describe("changedAirports", () => {
  it("counts changed partners and falls back to the earlier month's airports", () => {
    const rows: RouteRow[] = [
      ["DL", "ATL", "BOS"],
      ["DL", "BOS", "ATL"],
      ["B6", "ATL", "OLD"],
      ["B6", "ATL", "XXX"],
    ];
    const result = changedAirports(rows, [airport("ATL"), airport("BOS")], [airport("OLD")]);
    expect(result.map((a) => [a.properties.IATA, a.properties.destinations])).toEqual([
      ["ATL", 3],
      ["BOS", 1],
      ["OLD", 1],
    ]);
  });
});

describe("changeProblems", () => {
  it("keeps problems at either end of a changed route", () => {
    const problems = [problem("ATL"), problem("BOS"), problem("ORD"), problem(null)];
    expect(changeProblems([["DL", "ATL", "BOS"]], problems)).toEqual(problems.slice(0, 2));
  });
});
