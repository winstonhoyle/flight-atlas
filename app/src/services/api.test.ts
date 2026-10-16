import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMonths, fetchProblems, fetchRoutes, snapshotParams } from "./api";

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchMonths", () => {
  it("labels and sorts months newest first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond(200, [
          { month: "9", year: "2026" },
          { month: "10", year: "2026" },
          { month: "12", year: "2025" },
        ]),
      ),
    );

    expect(await fetchMonths()).toEqual([
      { label: "October 2026", month: "10", year: 2026 },
      { label: "September 2026", month: "09", year: 2026 },
      { label: "December 2025", month: "12", year: 2025 },
    ]);
  });

  it("rejects a response of the wrong shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(200, { error: "nope" })),
    );
    await expect(fetchMonths()).rejects.toThrow("Unexpected response from /available_months");
  });

  it("rejects an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(404, { error: "No data for that month" })),
    );
    await expect(fetchMonths()).rejects.toThrow("HTTP error 404");
  });
});

describe("fetchRoutes", () => {
  it("fetches the whole month's routes", async () => {
    const rows = [["DL", "ATL", "BOS"]];
    const fetchMock = vi.fn(async () => respond(200, rows));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchRoutes({ label: "October 2026", month: "10", year: 2026 })).toEqual(rows);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/routes\?year=2026&month=10$/));
  });

  it("rejects rows that aren't [airline, src, dst]", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(200, [["DL", "ATL"]])),
    );
    await expect(fetchRoutes(null)).rejects.toThrow("Unexpected response from /routes");
  });
});

describe("snapshotParams", () => {
  it("names the snapshot, or nothing so the API picks the newest", () => {
    expect(snapshotParams({ label: "February 2026", month: "02", year: 2026 }).toString()).toBe(
      "year=2026&month=02",
    );
    expect(snapshotParams(null).toString()).toBe("");
  });
});

describe("fetchProblems", () => {
  it("treats a month without a report as having no problems", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(404, { error: "No data for that month" })),
    );
    expect(await fetchProblems(null)).toEqual([]);
  });
});
