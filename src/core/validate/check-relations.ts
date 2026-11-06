import { relationFkName } from "../ir/naming";
import type { EntityDef } from "../model/schema";
import { FIELD_NAME, issue, type ValidationIssue } from "./types";

export function checkRelations(
  entity: EntityDef,
  issues: ValidationIssue[],
  fieldNames: Set<string>,
  entityIds: Set<string>,
  system: boolean,
): void {
  const relationNames = new Set<string>();

  for (const relation of entity.relations) {
    if (!FIELD_NAME.test(relation.name)) {
      issues.push(
        issue({
          code: "relation.name.invalid",
          entityId: entity.id,
          relationId: relation.id,
          message: `"${relation.name}" is not a valid relation name (use camelCase).`,
        }),
      );
    }

    if (fieldNames.has(relation.name)) {
      issues.push(
        issue({
          code: "relation.name.conflict",
          entityId: entity.id,
          relationId: relation.id,
          message: `Relation "${relation.name}" conflicts with a field of the same name.`,
        }),
      );
    }

    if (relationNames.has(relation.name)) {
      issues.push(
        issue({
          code: "relation.name.duplicate",
          entityId: entity.id,
          relationId: relation.id,
          message: `Duplicate relation "${relation.name}".`,
        }),
      );
    }
    relationNames.add(relation.name);

    if (!entityIds.has(relation.targetEntityId)) {
      issues.push(
        issue({
          code: "relation.target.missing",
          entityId: entity.id,
          relationId: relation.id,
          message: `Relation "${relation.name}" targets a missing entity.`,
        }),
      );
    }

    if (relation.kind === "one-to-many") {
      issues.push(
        issue({
          code: "relation.one-to-many.stored",
          entityId: entity.id,
          relationId: relation.id,
          message: `One-to-many relations are derived; add a many-to-one on the target entity instead.`,
        }),
      );
    }
  }

  const generatedColumns: string[] = [];
  if (system || entity.options.timestamps) generatedColumns.push("createdAt", "updatedAt");
  if (system || entity.options.softDelete) generatedColumns.push("deletedAt");

  for (const name of generatedColumns) {
    if (fieldNames.has(name) || relationNames.has(name)) {
      issues.push(
        issue({
          code: "entity.generatedColumn.collision",
          entityId: entity.id,
          message: `${entity.name} already uses "${name}", which is reserved for a generated timestamp column.`,
        }),
      );
    }
  }

  const usedRelationColumns = new Set([...fieldNames, ...relationNames, ...generatedColumns]);
  const relationForeignKeys = new Set<string>();
  for (const relation of entity.relations) {
    if (relation.kind !== "many-to-one" && relation.kind !== "one-to-one") continue;

    const fkName = relationFkName(relation.name);
    if (usedRelationColumns.has(fkName) || relationForeignKeys.has(fkName)) {
      issues.push(
        issue({
          code: "relation.foreignKey.collision",
          entityId: entity.id,
          relationId: relation.id,
          message: `Relation "${relation.name}" needs a foreign key named "${fkName}", but that name is already used.`,
        }),
      );
    }
    relationForeignKeys.add(fkName);
  }
}
