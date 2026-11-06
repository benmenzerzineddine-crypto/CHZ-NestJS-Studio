import type { FieldDef } from "@/core/model/schema";
import { FlagToggle } from "./FieldHelpers";

export interface FieldFlagsSectionProps {
  field: FieldDef;
  locked: boolean;
  onUpdate: (patch: Partial<FieldDef>) => void;
}

export function FieldFlagsSection({
  field,
  locked,
  onUpdate,
}: FieldFlagsSectionProps) {
  const isPrimaryKeyType = field.type === "uuid" || field.type === "int";

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <FlagToggle
        label="Required"
        checked={field.required}
        disabled={field.primary || locked}
        onChange={(required) => onUpdate({ required })}
      />
      <FlagToggle
        label="Unique"
        checked={field.unique}
        disabled={locked}
        onChange={(unique) => onUpdate({ unique })}
      />
      <FlagToggle
        label="Indexed"
        checked={field.indexed}
        onChange={(indexed) => onUpdate({ indexed })}
      />
      <FlagToggle
        label="Primary key"
        checked={field.primary}
        disabled={locked || !isPrimaryKeyType}
        hint={!isPrimaryKeyType ? "uuid or int only" : undefined}
        onChange={(primary) => onUpdate({ primary })}
      />
    </div>
  );
}
