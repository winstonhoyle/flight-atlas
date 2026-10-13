import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Legend } from "./Legend";

describe("Legend", () => {
  it("lists every bin smallest first and collapses", async () => {
    render(<Legend />);
    const items = within(screen.getByRole("list", { name: "Destinations" })).getAllByRole(
      "listitem",
    );
    expect(items.map((i) => i.textContent)).toEqual([
      "1–10",
      "11–20",
      "21–50",
      "51–100",
      "Over 100",
    ]);

    const toggle = screen.getByRole("button", { name: "Collapse legend" });
    await userEvent.click(toggle);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand legend" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
