import { describe, expect, it } from "vitest";
import { airlineAnchor, errorsUrl, groupBy } from "./problems";

describe("problems", () => {
  it("links to an anchor in the chosen month", () => {
    expect(errorsUrl("YYT", { label: "October 2026", month: "10", year: 2026 })).toBe(
      "/errors?year=2026&month=10#YYT",
    );
    expect(errorsUrl("YYT", null)).toBe("/errors#YYT");
  });

  it("makes airline names safe anchors", () => {
    expect(airlineAnchor("Aéreo Servicio Guerrero")).toBe("airline-A-reo-Servicio-Guerrero");
  });

  it("groups in order and skips items without a key", () => {
    const groups = groupBy(["YYT", null, "ATL", "YYT"], (x) => x);
    expect([...groups]).toEqual([
      ["YYT", ["YYT", "YYT"]],
      ["ATL", ["ATL"]],
    ]);
  });
});
