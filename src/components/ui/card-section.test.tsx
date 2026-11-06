import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardSection } from "./card-section";

describe("CardSection", () => {
  it("renders title, description, and children", () => {
    render(
      <CardSection title="Database Settings" description="Configure database connection">
        <div>Content body</div>
      </CardSection>,
    );

    expect(screen.getByText("Database Settings")).toBeInTheDocument();
    expect(screen.getByText("Configure database connection")).toBeInTheDocument();
    expect(screen.getByText("Content body")).toBeInTheDocument();
  });

  it("renders action slot when provided", () => {
    render(
      <CardSection
        title="Active Section"
        action={<button type="button">Action Button</button>}
      >
        <div>Body</div>
      </CardSection>,
    );

    expect(screen.getByRole("button", { name: "Action Button" })).toBeInTheDocument();
  });
});
