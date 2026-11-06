import { Switch as HeroUISwitch } from "@heroui/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps
  extends Omit<ComponentProps<typeof HeroUISwitch>, "onChange" | "isSelected"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  isSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  disabled?: boolean;
  isDisabled?: boolean;
}

export function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  isSelected,
  onChange,
  disabled,
  isDisabled,
  ...props
}: SwitchProps) {
  const selected = checked ?? isSelected;
  const handleChange = (val: boolean) => {
    onCheckedChange?.(val);
    onChange?.(val);
  };

  return (
    <HeroUISwitch
      isSelected={selected}
      defaultSelected={defaultChecked}
      onChange={handleChange}
      isDisabled={disabled ?? isDisabled}
      className={cn(className)}
      {...props}
    >
      <HeroUISwitch.Content>
        <HeroUISwitch.Control>
          <HeroUISwitch.Thumb />
        </HeroUISwitch.Control>
      </HeroUISwitch.Content>
    </HeroUISwitch>
  );
}

