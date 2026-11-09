import { describe, expect, it } from "vitest";
import { translator } from "@/i18n/translate";
import {
  EMPTY_SELECTION,
  buildSelectionPath,
  parseSelectionPath,
  selectionTitle,
  type Selection,
} from "./selectionPath";

const english = translator({}).t;
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

describe("locale prefixes", () => {
  it("reads the selection after a language prefix", () => {
    expect(parseSelectionPath("/es/ATL")).toEqual(sel({ airport: "ATL" }));
    expect(parseSelectionPath("/fr/ATL/airline/DL")).toEqual(
      sel({ airport: "ATL", airline: "DL" }),
    );
    expect(parseSelectionPath("/pt/airline/UA")).toEqual(sel({ airline: "UA" }));
    expect(parseSelectionPath("/es/")).toEqual(EMPTY_SELECTION);
  });
});

describe("selectionTitle", () => {
  it("names the route, airport, or airline", () => {
    expect(selectionTitle(english, sel({ airport: "ATL", destination: "BOS" }))).toBe(
      "ATL to BOS direct flights | Flight Atlas",
    );
    expect(selectionTitle(english, sel({ airport: "ATL" }), undefined, "Atlanta")).toBe(
      "Direct flights from Atlanta (ATL) | Flight Atlas",
    );
    expect(selectionTitle(english, sel({ airline: "DL" }), "Delta Air Lines")).toBe(
      "Delta Air Lines routes in the Americas | Flight Atlas",
    );
  });

  it("uses the language's catalog", () => {
    const es = translator({
      "{from} to {to} direct flights": "Vuelos directos de {from} a {to}",
    }).t;
    expect(selectionTitle(es, sel({ airport: "ATL", destination: "BOS" }))).toBe(
      "Vuelos directos de ATL a BOS | Flight Atlas",
    );
  });
});
