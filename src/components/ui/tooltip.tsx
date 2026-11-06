import { Tooltip as HeroUITooltip } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function TooltipProvider({ children }: { children: ReactNode; delayDuration?: number }) {
  return <>{children}</>;
}

export const Tooltip = HeroUITooltip;

export function TooltipTrigger({
  asChild: _asChild,
  children,
  ...props
}: ComponentProps<typeof HeroUITooltip.Trigger> & { asChild?: boolean }) {
  return (
    <HeroUITooltip.Trigger {...props}>
      {children}
    </HeroUITooltip.Trigger>
  );
}

export function TooltipContent({
  className,
  children,
  ...props
}: ComponentProps<typeof HeroUITooltip.Content>) {
  return (
    <HeroUITooltip.Content
      className={cn(
        "z-[70] max-w-xs rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-foreground shadow-lg shadow-black/40",
        className,
      )}
      {...props}
    >
      {children}
    </HeroUITooltip.Content>
  );
}

