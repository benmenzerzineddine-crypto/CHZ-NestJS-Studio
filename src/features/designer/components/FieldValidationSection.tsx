import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldDef, FieldValidators } from "@/core/model/schema";
import { optionalNumber } from "./FieldHelpers";

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
              <Input
                id="field-min"
                type="number"
                value={field.validators?.min ?? ""}
                onChange={(event) =>
                  onUpdateValidators({ min: optionalNumber(event.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-max">Maximum</Label>
              <Input
                id="field-max"
                type="number"
                value={field.validators?.max ?? ""}
                onChange={(event) =>
                  onUpdateValidators({ max: optionalNumber(event.target.value) })
                }
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
              <Input
                id="field-min-length"
                type="number"
                min={0}
                value={field.validators?.minLength ?? ""}
                onChange={(event) =>
                  onUpdateValidators({ minLength: optionalNumber(event.target.value, 0) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-max-length">Max length</Label>
              <Input
                id="field-max-length"
                type="number"
                min={1}
                value={field.validators?.maxLength ?? ""}
                onChange={(event) =>
                  onUpdateValidators({ maxLength: optionalNumber(event.target.value, 1) })
                }
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
