import { Check, Minus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { FieldType } from "@/core/model/schema";

export const TYPE_LABELS: Record<FieldType, string> = {
  string: "String",
  text: "Text",
  int: "Integer",
  float: "Float",
  decimal: "Decimal",
  boolean: "Boolean",
  date: "Date",
  datetime: "DateTime",
  uuid: "UUID",
  json: "JSON",
  enum: "Enum",
};

export function optionalNumber(raw: string, min?: number): number | undefined {
  if (!raw.trim()) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  if (min !== undefined && value < min) return undefined;
  return value;
}

export function FlagCell({ value }: { value: boolean }) {
  return value ? (
    <Check className="mx-auto h-4 w-4 text-success" aria-label="yes" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-muted/40" aria-label="no" />
  );
}

export interface FlagToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}

export function FlagToggle({ label, checked, onChange, disabled, hint }: FlagToggleProps) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="text-foreground">{label}</span>
        {hint ? <span className="block text-[11px] text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
