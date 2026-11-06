import type { ReactNode } from "react";
import { Label } from "./label";
import { Switch } from "./switch";
import { cn } from "@/lib/cn";

export interface FormRowProps {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  controlClassName?: string;
}

export function FormRow({
  label,
  hint,
  htmlFor,
  children,
  className,
  controlClassName,
}: FormRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="max-w-sm">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p> : null}
      </div>
      <div className={cn("w-full sm:w-64", controlClassName)}>{children}</div>
    </div>
  );
}

export interface ToggleRowProps {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  variant?: "row" | "card";
  className?: string;
}

export function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled = false,
  ariaLabel,
  variant = "row",
  className,
}: ToggleRowProps) {
  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-raised/40 p-3",
          className,
        )}
      >
        <div>
          <p className="text-sm text-foreground">{label}</p>
          <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-6 px-5 py-4",
        className,
      )}
    >
      <div className="max-w-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
      />
    </div>
  );
}
