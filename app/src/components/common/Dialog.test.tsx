import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("opens as a named dialog and focuses the marked element", () => {
    render(
      <Dialog open onClose={() => {}} label="Welcome">
        <a href="#x">First link</a>
        <button data-autofocus>Close</button>
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "Welcome" })).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("closes when the parent sets open to false", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog open onClose={onClose} label="Welcome">
        text
      </Dialog>,
    );
    rerender(
      <Dialog open={false} onClose={onClose} label="Welcome">
        text
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
