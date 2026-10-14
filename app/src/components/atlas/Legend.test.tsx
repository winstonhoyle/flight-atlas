import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Legend } from "./Legend";

describe("Legend", () => {
  it("lists every bin largest first and collapses", async () => {
    render(<Legend />);
    const items = within(screen.getByRole("list", { name: "Destinations" })).getAllByRole(
      "listitem",
    );
    expect(items.map((i) => i.textContent)).toEqual([
      "Over 100",
      "51–100",
      "21–50",
      "11–20",
      "1–10",
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
