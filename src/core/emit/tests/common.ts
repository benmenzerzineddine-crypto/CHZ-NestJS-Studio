import type { EntityIR, ProjectIR, RelationIR } from "../../ir/types";

export function apiBase(ir: ProjectIR): string {
  return `/${ir.apiPrefix}`;
}

export function entityPath(ir: ProjectIR, entity: EntityIR): string {
  return `${apiBase(ir)}/${entity.restPath}`;
}

export function importPath(path: string): string {
  return `../${path.replace(/\.ts$/, "")}`;
}

export function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function isRequiredRelation(relation: RelationIR): boolean {
  return (
    (relation.kind === "many-to-one" || relation.kind === "one-to-one") &&
    !relation.nullable &&
    !relation.owner &&
    !relation.target.isSystem
  );
}

export function hasUnsupportedPattern(entity: EntityIR): boolean {
  return entity.fields.some(
    (field) =>
      !field.primary &&
      field.required &&
      field.defaultValue === undefined &&
      field.definition.validators?.pattern !== undefined,
  );
}

export function buildableEntities(ir: ProjectIR): Set<string> {
  const state = new Map<string, "visiting" | "ok" | "bad">();

  const visit = (entity: EntityIR): boolean => {
    if (entity.isSystem) return true;
    const current = state.get(entity.id);
    if (current === "ok") return true;
    if (current === "visiting" || current === "bad") return false;

    if (hasUnsupportedPattern(entity)) {
      state.set(entity.id, "bad");
      return false;
    }

    state.set(entity.id, "visiting");
    for (const relation of entity.relations) {
      if (!isRequiredRelation(relation)) continue;
      if (!visit(relation.target)) {
        state.set(entity.id, "bad");
        return false;
      }
    }
    state.set(entity.id, "ok");
    return true;
  };

  for (const entity of ir.entities) visit(entity);
  return new Set(ir.entities.filter((entity) => state.get(entity.id) === "ok").map((entity) => entity.id));
}
