import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MethodBadge } from "./method-badge";

describe("MethodBadge", () => {
  it("renders HTTP methods with correct text", () => {
    const { rerender } = render(<MethodBadge method="GET" />);
    expect(screen.getByText("GET")).toBeInTheDocument();

    rerender(<MethodBadge method="POST" />);
    expect(screen.getByText("POST")).toBeInTheDocument();

    rerender(<MethodBadge method="DELETE" />);
    expect(screen.getByText("DELETE")).toBeInTheDocument();
  });
});
