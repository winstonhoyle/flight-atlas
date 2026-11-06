import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("reports the new value when clicked", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Compare months" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Compare months" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("can't be clicked when disabled", () => {
    render(<Checkbox label="Compare months" checked onChange={() => {}} disabled />);
    expect(screen.getByRole("checkbox", { name: "Compare months" })).toBeDisabled();
  });
});
