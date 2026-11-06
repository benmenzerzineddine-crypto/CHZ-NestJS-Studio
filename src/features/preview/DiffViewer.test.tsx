import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiffViewer } from "./DiffViewer";

describe("DiffViewer", () => {
  it("renders status badge and description for added file", () => {
    render(
      <DiffViewer
        path="src/new.ts"
        original={null}
        modified="export const a = 1;"
        status="added"
      />,
    );

    expect(screen.getByText("New file (added)")).toBeInTheDocument();
    expect(
      screen.getByText("This file did not exist in the previous generation."),
    ).toBeInTheDocument();
  });

  it("renders status badge and description for modified file", () => {
    render(
      <DiffViewer
        path="src/main.ts"
        original="export const a = 1;"
        modified="export const a = 2;"
        status="modified"
      />,
    );

    expect(screen.getByText("Modified")).toBeInTheDocument();
    expect(screen.getByText("Comparing against previous generation.")).toBeInTheDocument();
  });

  it("renders status badge and description for unchanged file", () => {
    render(
      <DiffViewer
        path="README.md"
        original="# Hello"
        modified="# Hello"
        status="unchanged"
      />,
    );

    expect(screen.getByText("Unchanged")).toBeInTheDocument();
    expect(screen.getByText("Content is identical to previous generation.")).toBeInTheDocument();
  });
});
