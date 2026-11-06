import React, { useMemo, type ReactNode } from "react";
import { Select as HeroSelect, ListBox } from "@heroui/react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: ReactNode;
  textValue?: string;
  disabled?: boolean;
}

export type SelectProps = {
  id?: string;
  name?: string;
  className?: string;
  placeholder?: string;
  children?: ReactNode;
  options?: SelectOption[];
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  selectedKey?: string | number | null;
  defaultSelectedKey?: string | number;
  disabled?: boolean;
  isDisabled?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onSelectionChange?: (key: React.Key | null) => void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
  autoComplete?: string;
};

function hasOptionChildren(children: ReactNode): boolean {
  let hasOption = false;
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && (child.type === "option" || (child.props as any)?.value !== undefined)) {
      hasOption = true;
    }
  });
  return hasOption;
}

function parseOptionChildren(children: ReactNode): SelectOption[] {
  const result: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      const p = child.props as any;
      if (child.type === "option" || p?.value !== undefined) {
        result.push({
          value: String(p.value ?? ""),
          label: p.children ?? String(p.value ?? ""),
          textValue: typeof p.children === "string" ? p.children : String(p.value ?? ""),
          disabled: Boolean(p.disabled),
        });
      }
    }
  });
  return result;
}

export function Select({
  id,
  className,
  options,
  children,
  value,
  defaultValue,
  selectedKey,
  defaultSelectedKey,
  onChange,
  onSelectionChange,
  disabled,
  isDisabled,
  placeholder,
  ...props
}: SelectProps) {
  const isShorthand = Boolean(options) || hasOptionChildren(children);

  const resolvedSelectedKey = useMemo(() => {
    if (selectedKey !== undefined) {
      return selectedKey !== null ? String(selectedKey) : null;
    }
    if (value !== undefined) {
      return String(value);
    }
    return undefined;
  }, [selectedKey, value]);

  const resolvedDefaultSelectedKey = useMemo(() => {
    if (defaultSelectedKey !== undefined) {
      return String(defaultSelectedKey);
    }
    if (defaultValue !== undefined) {
      return String(defaultValue);
    }
    return undefined;
  }, [defaultSelectedKey, defaultValue]);

  const effectiveDisabled = isDisabled ?? disabled;

  const handleSelectionChange = (key: React.Key | null) => {
    onSelectionChange?.(key);
    if (onChange && key !== null) {
      const syntheticEvent = {
        target: { value: String(key), name: props.name },
        currentTarget: { value: String(key), name: props.name },
      } as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  };

  // If using shorthand (options array or <option> children), compose HeroUI compound components
  if (isShorthand) {
    const parsedOptions = options ?? parseOptionChildren(children);

    return (
      <div className="relative w-full">
        {/* Labellable HTML select for testing-library, standard HTML forms & label associations */}
        <select
          id={id}
          name={props.name}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          value={resolvedSelectedKey ?? ""}
          disabled={effectiveDisabled}
          onChange={(e) => {
            handleSelectionChange(e.target.value);
          }}
          tabIndex={-1}
          className="sr-only absolute pointer-events-none opacity-0 h-0 w-0"
        >
          {parsedOptions.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {typeof opt.label === "string" ? opt.label : opt.textValue ?? opt.value}
            </option>
          ))}
        </select>

        {/* HeroUI compound select visual presentation */}
        <div aria-hidden="true" className="w-full">
          <HeroSelect
            className={cn("w-full", className)}
            placeholder={placeholder}
            selectedKey={resolvedSelectedKey}
            defaultSelectedKey={resolvedDefaultSelectedKey}
            isDisabled={effectiveDisabled}
            onSelectionChange={handleSelectionChange}
          >
            <HeroSelect.Trigger aria-hidden="true">
              <HeroSelect.Value />
              <HeroSelect.Indicator />
            </HeroSelect.Trigger>
            <HeroSelect.Popover>
              <ListBox>
                {parsedOptions.map((opt) => (
                  <ListBox.Item
                    key={opt.value}
                    id={opt.value}
                    textValue={opt.textValue ?? (typeof opt.label === "string" ? opt.label : opt.value)}
                    isDisabled={opt.disabled}
                  >
                    {opt.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </HeroSelect.Popover>
          </HeroSelect>
        </div>
      </div>
    );
  }

  // Compound component usage: compose directly as HeroSelect root
  return (
    <HeroSelect
      id={id}
      className={className}
      placeholder={placeholder}
      selectedKey={resolvedSelectedKey}
      defaultSelectedKey={resolvedDefaultSelectedKey}
      isDisabled={effectiveDisabled}
      onSelectionChange={handleSelectionChange}
      {...props}
    >
      {children}
    </HeroSelect>
  );
}

// Attach HeroUI subcomponents for compound dot-notation access:
// <Select.Trigger>, <Select.Value>, <Select.Indicator>, <Select.Popover>, etc.
Select.Trigger = HeroSelect.Trigger;
Select.Value = HeroSelect.Value;
Select.Indicator = HeroSelect.Indicator;
Select.ClearButton = HeroSelect.ClearButton;
Select.Popover = HeroSelect.Popover;
Select.Item = ListBox.Item;
Select.ItemIndicator = ListBox.ItemIndicator;
Select.ListBox = ListBox;

// Re-export HeroUI primitives
export { HeroSelect, ListBox };
