import { TextArea as HeroUITextArea } from "@heroui/react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Textarea({
  className,
  fullWidth = true,
  ...props
}: ComponentProps<typeof HeroUITextArea>) {
  return (
    <HeroUITextArea
      fullWidth={fullWidth}
      className={cn(
        "min-h-20 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

