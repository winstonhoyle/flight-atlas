import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CloseIcon } from "@/icons";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("is named by its label, not its icon", () => {
    render(
      <IconButton label="Close route info">
        <CloseIcon />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Close route info" });
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
