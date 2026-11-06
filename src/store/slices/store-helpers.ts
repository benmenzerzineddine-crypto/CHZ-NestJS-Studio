import type { EntityDef, FieldDef, FieldType, Project } from "@/core/model/schema";
import { OPERATIONS } from "@/core/model/schema";

export function uniqueEntityName(base: string, entities: EntityDef[]): string {
  let name = base;
  let index = 2;
  while (entities.some((entity) => entity.name.toLowerCase() === name.toLowerCase())) {
    name = `${base}${index}`;
    index += 1;
  }
  return name;
}

export function normalizeField(field: FieldDef, patch: Partial<FieldDef>, previousType: FieldType): void {
  if (patch.type && patch.type !== previousType) {
    if (patch.type !== "enum") field.enumId = undefined;
    if (patch.type !== "string" && patch.type !== "decimal") field.column = undefined;
    if (field.primary && patch.type !== "uuid" && patch.type !== "int") field.primary = false;

    if (patch.type !== "int" && patch.type !== "float" && patch.type !== "decimal" && field.validators) {
      field.validators = {
        minLength: field.validators.minLength,
        maxLength: field.validators.maxLength,
        pattern: field.validators.pattern,
      };
    }

    if (patch.type !== "string" && patch.type !== "text" && field.validators) {
      field.validators = {
        min: field.validators.min,
        max: field.validators.max,
      };
    }
  }

  if (patch.required === false && field.primary) {
    field.primary = false;
  }
}

export function isRoleUsed(project: Project, key: string): boolean {
  return project.entities.some((entity) =>
    OPERATIONS.some((operation) => entity.access[operation].roles?.includes(key)),
  );
}
