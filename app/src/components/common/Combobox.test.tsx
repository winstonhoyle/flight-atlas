import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "./Combobox";

type Option = { value: string; label: string };

const OPTIONS: Option[] = [
  { value: "ATL", label: "Atlanta (ATL)" },
  { value: "BOS", label: "Boston (BOS)" },
];

describe("Combobox", () => {
  it("filters as you type and returns the chosen option", async () => {
    const onChange = vi.fn();
    render(<Combobox label="Airport" options={OPTIONS} value={null} onChange={onChange} />);

    await userEvent.type(screen.getByRole("combobox", { name: "Airport" }), "bos");
    expect(screen.queryByText("Atlanta (ATL)")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Boston (BOS)"));

    expect(onChange).toHaveBeenCalledWith(OPTIONS[1], expect.anything());
  });

  it("shows the selected value", () => {
    render(<Combobox label="Airport" options={OPTIONS} value={OPTIONS[0]} onChange={() => {}} />);
    expect(screen.getByText("Atlanta (ATL)")).toBeInTheDocument();
  });
});
