import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormRow, ToggleRow } from "./form-row";

describe("FormRow & ToggleRow", () => {
  it("renders FormRow with label, hint, and input", () => {
    render(
      <FormRow label="Server Port" hint="Default is 3000" htmlFor="port-input">
        <input id="port-input" defaultValue="3000" />
      </FormRow>,
    );

    expect(screen.getByLabelText("Server Port")).toHaveValue("3000");
    expect(screen.getByText("Default is 3000")).toBeInTheDocument();
  });

  it("renders ToggleRow in row variant and toggles", () => {
    const onCheckedChange = vi.fn();

    render(
      <ToggleRow
        label="Enable Feature"
        hint="Turn this on to enable"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    const toggle = screen.getByLabelText("Enable Feature");
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("renders ToggleRow in card variant", () => {
    const onCheckedChange = vi.fn();

    render(
      <ToggleRow
        variant="card"
        label="Card Toggle"
        hint="Card hint"
        checked={true}
        onCheckedChange={onCheckedChange}
      />,
    );

    const toggle = screen.getByLabelText("Card Toggle");
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});
