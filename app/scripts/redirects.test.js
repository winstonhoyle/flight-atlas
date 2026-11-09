import { describe, expect, it } from "vitest";
import { redirectRules } from "./pages.js";

const rules = redirectRules()
  .trim()
  .split("\n")
  .map((line) => line.split(" "));
const at = (source) => rules.findIndex(([from]) => from === source);

describe("redirectRules", () => {
  it("lets the built files through before any rule that matches two path segments", () => {
    const catchAll = rules.findIndex(([from]) => from.startsWith("/:"));
    // /assets/index-abc.js has two segments, so /:airport/:destination would answer it with the app.
    expect(rules[at("/assets/*")]).toEqual(["/assets/*", "/assets/:splat", "200"]);
    expect(at("/assets/*")).toBeLessThan(catchAll);
    expect(at("/airline/:code")).toBeLessThan(catchAll);
  });

  it("lets each language's own pages through before the English catch-alls", () => {
    // /es/ATL would otherwise match /:airport/:destination and be answered with the English app.
    const catchAll = at("/:airport/:destination");
    for (const l of ["es", "fr", "pt"]) {
      expect(at(`/${l}/airline/:code`)).toBeLessThan(at(`/${l}/:airport/airline/:code`));
      expect(at(`/${l}/:page`)).toBeLessThan(catchAll);
      expect(rules[at(`/${l}/:airport/:destination`)][1]).toBe(`/${l}/app`);
    }
    expect(rules[at("/:airport/:destination")][1]).toBe("/app");
  });

  it("stays under the host's limit of 100 dynamic rules", () => {
    expect(rules.length).toBeLessThan(100);
  });
});
