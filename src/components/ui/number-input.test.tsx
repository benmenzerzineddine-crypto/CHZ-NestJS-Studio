import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberInput } from "./number-input";

describe("NumberInput component with HeroUI v3", () => {
  it("renders with initial value and connects to label", () => {
    const handleChange = vi.fn();
    render(
      <div>
        <label htmlFor="ttl-input">TTL Seconds</label>
        <NumberInput
          id="ttl-input"
          value={60}
          min={1}
          max={3600}
          onChange={handleChange}
        />
      </div>
    );

    const input = screen.getByLabelText("TTL Seconds");
    expect(input).toHaveValue(60);
  });

  it("handles user typing change", () => {
    const handleChange = vi.fn();
    render(
      <div>
        <label htmlFor="len-input">Column length</label>
        <NumberInput
          id="len-input"
          min={1}
          max={65535}
          onChange={handleChange}
        />
      </div>
    );

    const input = screen.getByLabelText("Column length");
    fireEvent.change(input, { target: { value: "120" } });
    expect(handleChange).toHaveBeenCalledWith(120);
  });

  it("handles user change and increments/decrements", () => {
    const handleChange = vi.fn();
    render(
      <NumberInput
        id="count-input"
        aria-label="Item Count"
        defaultValue={10}
        min={0}
        onChange={handleChange}
      />
    );

    const incBtn = screen.getByRole("button", { name: /increase/i });
    fireEvent.click(incBtn);
    expect(handleChange).toHaveBeenCalledWith(11);

    const decBtn = screen.getByRole("button", { name: /decrease/i });
    fireEvent.click(decBtn);
    expect(handleChange).toHaveBeenCalledWith(10);
  });

  it("renders with HeroUI compound NumberField syntax", () => {
    render(
      <NumberInput className="w-full max-w-64" defaultValue={1024} minValue={0} name="width" aria-label="Width">
        <NumberInput.Group>
          <NumberInput.DecrementButton />
          <NumberInput.Input className="w-[120px]" />
          <NumberInput.IncrementButton />
        </NumberInput.Group>
      </NumberInput>
    );

    const input = screen.getByLabelText("Width");
    expect(input).toHaveValue("1,024");
  });
});
