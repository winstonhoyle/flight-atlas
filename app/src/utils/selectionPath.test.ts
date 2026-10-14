import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  buildSelectionPath,
  parseSelectionPath,
  selectionTitle,
  type Selection,
} from "./selectionPath";

const sel = (s: Partial<Selection>): Selection => ({ ...EMPTY_SELECTION, ...s });

describe("selection paths", () => {
  it.each([
    ["/", sel({})],
    ["/ATL", sel({ airport: "ATL" })],
    ["/ATL/BOS", sel({ airport: "ATL", destination: "BOS" })],
    ["/airline/DL", sel({ airline: "DL" })],
    ["/ATL/airline/DL", sel({ airport: "ATL", airline: "DL" })],
  ])("round-trips %s", (path, selection) => {
    expect(parseSelectionPath(path)).toEqual(selection);
    expect(buildSelectionPath(selection)).toBe(path);
  });

  it("accepts lowercase codes and a trailing slash", () => {
    expect(parseSelectionPath("/atl/bos/")).toEqual(sel({ airport: "ATL", destination: "BOS" }));
  });

  it.each(["/ATLX", "/A1", "/ATL/BOS/JFK", "/airline/", "/airline/DELTA", "/about"])(
    "reads %s as no selection",
    (path) => {
      expect(parseSelectionPath(path)).toEqual(EMPTY_SELECTION);
    },
  );
});

describe("selectionTitle", () => {
  it("names the route, airport, or airline", () => {
    expect(selectionTitle(sel({ airport: "ATL", destination: "BOS" }))).toBe(
      "ATL to BOS direct flights | Flight Atlas",
    );
    expect(selectionTitle(sel({ airline: "DL" }), "Delta Air Lines")).toBe(
      "Delta Air Lines routes | Flight Atlas",
    );
  });
});
