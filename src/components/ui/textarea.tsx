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
        "min-h-20 w-full resize-y rounded-md border border-[var(--field-border)] bg-[var(--field-background)] px-3 py-2 text-sm text-[var(--field-foreground)] placeholder:text-[var(--field-placeholder)] transition-colors hover:border-[var(--field-border-hover)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
