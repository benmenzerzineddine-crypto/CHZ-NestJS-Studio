import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import type { FieldDef, FieldValidators } from "@/core/model/schema";

export interface FieldValidationSectionProps {
  field: FieldDef;
  onUpdateValidators: (patch: Partial<FieldValidators>) => void;
}

export function FieldValidationSection({
  field,
  onUpdateValidators,
}: FieldValidationSectionProps) {
  const isNumberType =
    field.type === "int" || field.type === "float" || field.type === "decimal";
  const isStringType = field.type === "string" || field.type === "text";

  if (!isNumberType && !isStringType) return null;

  return (
    <>
      {isNumberType ? (
        <div className="mt-5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Range</h4>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="field-min">Minimum</Label>
              <NumberInput
                id="field-min"
                value={field.validators?.min ?? ""}
                onChange={(val) => onUpdateValidators({ min: val })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-max">Maximum</Label>
              <NumberInput
                id="field-max"
                value={field.validators?.max ?? ""}
                onChange={(val) => onUpdateValidators({ max: val })}
              />
            </div>
          </div>
        </div>
      ) : null}

      {isStringType ? (
        <div className="mt-5">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Validation</h4>
          <div className="mt-2 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="field-min-length">Min length</Label>
              <NumberInput
                id="field-min-length"
                min={0}
                value={field.validators?.minLength ?? ""}
                onChange={(val) => onUpdateValidators({ minLength: val })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-max-length">Max length</Label>
              <NumberInput
                id="field-max-length"
                min={1}
                value={field.validators?.maxLength ?? ""}
                onChange={(val) => onUpdateValidators({ maxLength: val })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-pattern">Regex pattern</Label>
              <Input
                id="field-pattern"
                value={field.validators?.pattern ?? ""}
                maxLength={200}
                placeholder="^[a-z]+$"
                onChange={(event) =>
                  onUpdateValidators({ pattern: event.target.value || undefined })
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
