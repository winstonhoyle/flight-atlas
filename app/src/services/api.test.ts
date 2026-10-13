import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMonths, fetchRoutes } from "./api";

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

  it("rejects an unexpected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(200, { error: "nope" })),
    );
    await expect(fetchMonths()).rejects.toThrow("Invalid /available_months");
  });
});

describe("fetchRoutes", () => {
  it("polls past 202 responses until the routes arrive", async () => {
    vi.useFakeTimers();
    const routes = { type: "FeatureCollection", features: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(202, { status: "started", query_id: "q1" }))
      .mockResolvedValueOnce(respond(200, routes));
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchRoutes({ airportIata: "ATL", month: "10" });
    await vi.runAllTimersAsync();

    expect(await pending).toEqual(routes);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/routes?airport=ATL&month=10");
  });
});
