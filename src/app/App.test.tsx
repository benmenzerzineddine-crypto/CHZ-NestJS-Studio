import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/app/App";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the projects workspace when no project is open", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
  });
});
