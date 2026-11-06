import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("text-xs font-medium uppercase tracking-wide text-muted", className)}
      {...props}
    />
  );
}
