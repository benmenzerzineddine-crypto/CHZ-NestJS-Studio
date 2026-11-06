import type { ComponentProps, ReactNode } from "react";
import { NumberField } from "@heroui/react";
import { cn } from "@/lib/cn";

export interface NumberInputProps
  extends Omit<ComponentProps<typeof NumberField>, "value" | "defaultValue" | "onChange"> {
  id?: string;
  name?: string;
  value?: number | null | string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  hideSteppers?: boolean;
  children?: ReactNode;
  onChange?: (value: number | undefined) => void;
  onValueChange?: (value: number | undefined) => void;
}

export function NumberInput({
  id,
  name,
  value,
  defaultValue,
  min,
  max,
  minValue,
  maxValue,
  step = 1,
  placeholder,
  className,
  isDisabled,
  hideSteppers = false,
  onChange,
  onValueChange,
  children,
  "aria-label": ariaLabel,
  ...props
}: NumberInputProps) {
  const numValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : undefined;

  const effectiveMin = minValue ?? min;
  const effectiveMax = maxValue ?? max;

  const handleChange = (val: number | undefined) => {
    const res = val !== undefined && Number.isNaN(val) ? undefined : val;
    onChange?.(res);
    onValueChange?.(res);
  };

  return (
    <NumberField
      name={name}
      value={numValue}
      defaultValue={defaultValue}
      minValue={effectiveMin}
      maxValue={effectiveMax}
      step={step}
      isDisabled={isDisabled}
      aria-label={ariaLabel ?? name ?? id ?? "Number input"}
      onChange={(v) => handleChange(v)}
      className={cn("w-full", className)}
      {...props}
    >
      {children ?? (
        <NumberField.Group className="w-full">
          {!hideSteppers && (
            <NumberField.DecrementButton className="text-[var(--muted)] hover:text-[var(--field-foreground)] hover:bg-[var(--surface-hover)] transition-colors px-2" />
          )}
          <NumberField.Input
            id={id}
            type="number"
            placeholder={placeholder}
            className="w-full bg-transparent px-3 text-sm text-[var(--field-foreground)] placeholder:text-[var(--field-placeholder)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            onChange={(e: any) => {
              const raw = e?.target?.value;
              if (raw !== undefined) {
                const num = Number(raw);
                if (!Number.isNaN(num) && String(raw).trim() !== "") {
                  handleChange(num);
                } else if (String(raw).trim() === "") {
                  handleChange(undefined);
                }
              }
            }}
          />
          {!hideSteppers && (
            <NumberField.IncrementButton className="text-[var(--muted)] hover:text-[var(--field-foreground)] hover:bg-[var(--surface-hover)] transition-colors px-2" />
          )}
        </NumberField.Group>
      )}
    </NumberField>
  );
}

NumberInput.Group = NumberField.Group;
NumberInput.Input = NumberField.Input;
NumberInput.DecrementButton = NumberField.DecrementButton;
NumberInput.IncrementButton = NumberField.IncrementButton;

export { NumberField };
