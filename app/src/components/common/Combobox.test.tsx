import { fireEvent, render, screen } from "@testing-library/react";
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

  it("also searches the text from getOptionSearch", async () => {
    const options = [
      { value: "MHT", label: "Manchester–Boston Regional Airport (MHT)", search: "Manchester" },
      { value: "BOS", label: "Logan International Airport (BOS)", search: "Logan BOS Boston" },
    ];
    render(
      <Combobox
        label="Airport"
        options={options}
        value={null}
        onChange={() => {}}
        getOptionSearch={(o) => `${o.label} ${o.search}`}
      />,
    );

    await userEvent.type(screen.getByRole("combobox", { name: "Airport" }), "boston");
    expect(screen.getByText("Logan International Airport (BOS)")).toBeInTheDocument();
    expect(screen.getByText("Manchester–Boston Regional Airport (MHT)")).toBeInTheDocument();
  });

  it("opens on touch without the keyboard, and shows it on a second tap", async () => {
    render(<Combobox label="Airport" options={OPTIONS} value={null} onChange={() => {}} />);
    const input = screen.getByRole("combobox", { name: "Airport" });
    const text = screen.getByText("Select...");

    fireEvent.pointerDown(text, { pointerType: "touch" });
    expect(input).toHaveAttribute("inputmode", "none");

    await userEvent.click(text);
    expect(screen.getByText("Atlanta (ATL)")).toBeInTheDocument();
    fireEvent.pointerDown(text, { pointerType: "touch" });
    expect(input).toHaveAttribute("inputmode", "search");

    fireEvent.pointerDown(text, { pointerType: "mouse" });
    expect(input).not.toHaveAttribute("inputmode");
  });

  it("shows the selected value", () => {
    render(<Combobox label="Airport" options={OPTIONS} value={OPTIONS[0]} onChange={() => {}} />);
    expect(screen.getByText("Atlanta (ATL)")).toBeInTheDocument();
  });

  it("can't be used while disabled", () => {
    render(
      <Combobox label="Airport" options={OPTIONS} value={null} onChange={() => {}} isDisabled />,
    );
    expect(screen.getByLabelText("Airport")).toBeDisabled();
  });
});
