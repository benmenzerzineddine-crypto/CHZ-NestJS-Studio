import { Label as HeroUILabel } from "@heroui/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Label({ className, ...props }: ComponentProps<typeof HeroUILabel>) {
  return (
    <HeroUILabel
      className={cn("text-xs font-medium uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}
