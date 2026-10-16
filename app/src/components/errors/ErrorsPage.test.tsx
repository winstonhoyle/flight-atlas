import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Problem } from "@/types";
import { ErrorsPage } from "./ErrorsPage";

// OpenLayers needs a canvas, which jsdom doesn't have.
vi.mock("./ProblemsMap", () => ({ ProblemsMap: () => null }));

const problem = (overrides: Partial<Problem>): Problem => ({
  kind: "one_sided_route",
  airport: null,
  airport_name: null,
  airline: null,
  url: null,
  message: "",
  coordinates: null,
  ...overrides,
});

const PROBLEMS = [
  problem({
    kind: "destinations_table",
    airport: "YYT",
    airport_name: "St. John's International Airport",
    url: "https://en.wikipedia.org/wiki/St._John%27s_International_Airport",
    message: "No airlines table",
    coordinates: [-52.75, 47.62],
  }),
  problem({ kind: "airline_code", airline: "Mokulele Airlines", message: "No code" }),
];

vi.mock("@/services/api", () => ({
  fetchMonths: async () => [{ label: "October 2026", month: "10", year: 2026 }],
  fetchProblems: async () => PROBLEMS,
}));

describe("ErrorsPage", () => {
  it("lists each airport and airline under its own anchor", async () => {
    render(<ErrorsPage />);

    const yyt = await screen.findByRole("heading", {
      name: "St. John's International Airport (YYT)",
    });
    expect(yyt.closest("[id]")).toHaveAttribute("id", "YYT");
    expect(screen.getByText("Page doesn't follow the usual format")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Mokulele Airlines" }).closest("[id]"),
    ).toHaveAttribute("id", "airline-Mokulele-Airlines");
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 problems across 1 airport and 1 airline.",
    );
  });
});
