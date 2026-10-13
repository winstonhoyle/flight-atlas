import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExternalLink } from "./ExternalLink";

describe("ExternalLink", () => {
  it("opens in a new tab without exposing the opener, and says so", () => {
    render(<ExternalLink href="https://example.com">Docs</ExternalLink>);
    const link = screen.getByRole("link", { name: "Docs (opens in a new tab)" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
