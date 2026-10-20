import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "a", label: "First" },
  { value: "b", label: "Second" },
];

describe("SegmentedControl", () => {
  it("is a named radio group that reports the chosen value", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl label="Show" name="test" options={OPTIONS} value="a" onChange={onChange} />,
    );
    expect(screen.getByRole("group", { name: "Show" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "First" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Second" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
