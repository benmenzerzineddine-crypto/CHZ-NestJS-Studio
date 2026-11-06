import { Button as HeroUIButton } from "@heroui/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps
  extends Omit<ComponentProps<typeof HeroUIButton>, "size" | "variant"> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "tertiary";
  size?: "sm" | "md" | "lg" | "icon";
  disabled?: boolean;
  title?: string;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  disabled,
  isDisabled,
  type = "button",
  ...props
}: ButtonProps) {
  const isIconOnly = size === "icon" || props.isIconOnly;
  const heroSize = size === "icon" ? "md" : size;

  return (
    <HeroUIButton
      type={type}
      variant={variant}
      size={heroSize}
      isIconOnly={isIconOnly}
      isDisabled={disabled ?? isDisabled}
      className={cn(className)}
      {...props}
    />
  );
}

