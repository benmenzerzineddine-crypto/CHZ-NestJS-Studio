import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { FieldColumn, FieldDef, Project } from "@/core/model/schema";

export interface FieldColumnConfigSectionProps {
  field: FieldDef;
  project: Project;
  onUpdate: (patch: Partial<FieldDef>) => void;
  onUpdateColumn: (patch: Partial<FieldColumn>) => void;
}

export function FieldColumnConfigSection({
  field,
  project,
  onUpdate,
  onUpdateColumn,
}: FieldColumnConfigSectionProps) {
  return (
    <>
      {field.type === "enum" ? (
        <div className="mt-5 max-w-sm space-y-1.5">
          <Label htmlFor="field-enum">Enum</Label>
          <Select
            id="field-enum"
            value={field.enumId ?? ""}
            onChange={(event) => onUpdate({ enumId: event.target.value || undefined })}
          >
            <option value="">Choose enum…</option>
            {project.enums.map((enumDef) => (
              <option key={enumDef.id} value={enumDef.id}>
                {enumDef.name}
              </option>
            ))}
          </Select>
          {project.enums.length === 0 ? (
            <p className="text-[11px] text-warning">
              Create an enum in the Enums tab first.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="field-default">Default value</Label>
          <Input
            id="field-default"
            value={field.defaultValue ?? ""}
            maxLength={200}
            placeholder={
              field.type === "boolean"
                ? "false"
                : field.type === "int"
                  ? "0"
                  : "optional"
            }
            onChange={(event) =>
              onUpdate({ defaultValue: event.target.value || undefined })
            }
          />
          <p className="text-[11px] text-muted">
            Stored as a literal: booleans use true/false, strings are quoted when emitted.
          </p>
        </div>

        {field.type === "string" ? (
          <div className="space-y-1.5">
            <Label htmlFor="field-length">Column length</Label>
            <NumberInput
              id="field-length"
              min={1}
              max={65535}
              value={field.column?.length ?? ""}
              placeholder="255"
              onChange={(val) => onUpdateColumn({ length: val })}
            />
          </div>
        ) : null}

        {field.type === "decimal" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="field-precision">Precision</Label>
              <NumberInput
                id="field-precision"
                min={1}
                max={65}
                value={field.column?.precision ?? ""}
                placeholder="10"
                onChange={(val) => onUpdateColumn({ precision: val })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="field-scale">Scale</Label>
              <NumberInput
                id="field-scale"
                min={0}
                max={30}
                value={field.column?.scale ?? ""}
                placeholder="2"
                onChange={(val) => onUpdateColumn({ scale: val })}
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
