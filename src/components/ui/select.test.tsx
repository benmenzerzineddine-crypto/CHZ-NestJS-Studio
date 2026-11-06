import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./select";

describe("Select component with HeroUI theming", () => {
  it("renders with options array and handles change", () => {
    const handleChange = vi.fn();
    render(
      <label htmlFor="driver-select">
        Database Driver
        <Select
          id="driver-select"
          aria-label="Database Driver"
          value="sqlite"
          onChange={handleChange}
          options={[
            { value: "sqlite", label: "SQLite" },
            { value: "postgres", label: "PostgreSQL" },
            { value: "mysql", label: "MySQL" },
          ]}
        />
      </label>
    );

    const select = screen.getByLabelText("Database Driver");
    expect(select).toHaveValue("sqlite");
    fireEvent.change(select, { target: { value: "postgres" } });
    expect(handleChange).toHaveBeenCalled();
  });

  it("renders with option children and handles change", () => {
    const handleChange = vi.fn();
    render(
      <label htmlFor="fruit-select">
        Fruit
        <Select
          id="fruit-select"
          aria-label="Fruit"
          value="apple"
          onChange={handleChange}
        >
          <option value="apple">Apple</option>
          <option value="orange">Orange</option>
          <option value="banana">Banana</option>
        </Select>
      </label>
    );

    const select = screen.getByLabelText("Fruit");
    expect(select).toHaveValue("apple");
    fireEvent.change(select, { target: { value: "orange" } });
    expect(handleChange).toHaveBeenCalled();
  });

  it("renders with HeroUI compound component syntax without label", () => {
    const handleSelectionChange = vi.fn();
    render(
      <Select
        className="w-[256px]"
        placeholder="Select one"
        aria-label="State"
        selectedKey="florida"
        onSelectionChange={handleSelectionChange}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <Select.ListBox>
            <Select.Item id="florida" textValue="Florida">
              Florida
              <Select.ItemIndicator />
            </Select.Item>
            <Select.Item id="delaware" textValue="Delaware">
              Delaware
              <Select.ItemIndicator />
            </Select.Item>
            <Select.Item id="california" textValue="California">
              California
              <Select.ItemIndicator />
            </Select.Item>
          </Select.ListBox>
        </Select.Popover>
      </Select>
    );

    const trigger = screen.getByRole("button", { name: /State/ });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Florida");
  });
});
