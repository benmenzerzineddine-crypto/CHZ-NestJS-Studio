import { Chip } from "@heroui/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps extends Omit<ComponentProps<"span">, "color"> {
  variant?: "default" | "accent" | "success" | "warning" | "danger";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <Chip
      size="sm"
      variant="soft"
      color={variant as NonNullable<ComponentProps<typeof Chip>["color"]>}
      className={cn("text-[11px] font-medium", className)}
      {...props}
    >
      {children}
    </Chip>
  );
}

