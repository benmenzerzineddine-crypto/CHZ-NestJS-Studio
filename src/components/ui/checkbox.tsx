import { Checkbox as HeroUICheckbox } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps
  extends Omit<ComponentProps<typeof HeroUICheckbox>, "onChange" | "isSelected"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCheckedChange?: (checked: boolean) => void;
  isSelected?: boolean;
  disabled?: boolean;
  isDisabled?: boolean;
  readOnly?: boolean;
  isReadOnly?: boolean;
  children?: ReactNode;
}

export function Checkbox({
  className,
  checked,
  defaultChecked,
  onChange,
  onCheckedChange,
  isSelected,
  disabled,
  isDisabled,
  readOnly,
  isReadOnly,
  children,
  ...props
}: CheckboxProps) {
  const selected = checked ?? isSelected;

  const handleChange = (val: boolean) => {
    onCheckedChange?.(val);
    if (onChange) {
      const syntheticEvent = {
        target: { checked: val },
        currentTarget: { checked: val },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  };

  return (
    <HeroUICheckbox
      isSelected={selected}
      defaultSelected={defaultChecked}
      onChange={handleChange}
      isDisabled={disabled ?? isDisabled}
      isReadOnly={readOnly ?? isReadOnly}
      className={cn(className)}
      {...props}
    >
      <HeroUICheckbox.Content>
        <HeroUICheckbox.Control>
          <HeroUICheckbox.Indicator />
        </HeroUICheckbox.Control>
        {children}
      </HeroUICheckbox.Content>
    </HeroUICheckbox>
  );
}

