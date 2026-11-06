import { Input as HeroUIInput } from "@heroui/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Input({
  className,
  fullWidth = true,
  ...props
}: ComponentProps<typeof HeroUIInput>) {
  return (
    <HeroUIInput
      fullWidth={fullWidth}
      className={cn(
        "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground transition-colors placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

