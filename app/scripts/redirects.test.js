import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const rules = fs
  .readFileSync(path.join(process.cwd(), "public", "_redirects"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split(/\s+/));

describe("_redirects", () => {
  it("lets the built files through before any rule that matches two path segments", () => {
    const index = (source) => rules.findIndex(([from]) => from === source);
    const catchAll = rules.findIndex(([from]) => from.startsWith("/:"));
    // /assets/index-abc.js has two segments, so /:airport/:destination would answer it with the app.
    expect(index("/assets/*")).toBeGreaterThanOrEqual(0);
    expect(index("/assets/*")).toBeLessThan(catchAll);
    expect(rules[index("/assets/*")]).toEqual(["/assets/*", "/assets/:splat", "200"]);
    expect(index("/airline/:code")).toBeLessThan(catchAll);
  });
});
