import {
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toPlural,
  toRestPath,
  toSnakeCase,
  toTableName,
} from "../model/naming";
import type { EntityDef } from "../model/schema";
import type { EntityIR } from "./types";

export function entityNames(entity: EntityDef): Pick<
  EntityIR,
  "name" | "singularKebab" | "pluralKebab" | "restPath" | "tableName" | "moduleDir" | "dtoPrefix"
> {
  const singular = toKebabCase(entity.name);
  const plural = toKebabCase(toPlural(entity.name));
  return {
    name: entity.name,
    singularKebab: singular,
    pluralKebab: plural,
    restPath: toRestPath(entity.name),
    tableName: toTableName(entity.name),
    moduleDir: `src/modules/${singular}`,
    dtoPrefix: toKebabCase(entity.name),
  };
}

export function fieldColumnName(fieldName: string): string {
  return toSnakeCase(fieldName);
}

export function relationFkName(relationName: string): string {
  return `${relationName}Id`;
}

export function relationJoinColumnName(entityName: string): string {
  return `${toCamelCase(entityName)}Id`;
}

export function manyToManyTableName(source: EntityDef, target: EntityDef): string {
  return `${toTableName(source.name)}_${toTableName(target.name)}`;
}

export function relationJoinColumnPair(
  source: Pick<EntityIR, "name">,
  target: Pick<EntityIR, "name">,
): { joinColumnName: string; inverseJoinColumnName: string } {
  const left = relationJoinColumnName(source.name);
  const right = relationJoinColumnName(target.name);
  if (left !== right) {
    return { joinColumnName: left, inverseJoinColumnName: right };
  }
  return { joinColumnName: "sourceId", inverseJoinColumnName: "targetId" };
}

export function classNameFor(prefix: string, entityName: string): string {
  return `${prefix}${entityName}`;
}

export function enumMemberName(value: string): string {
  return value;
}

export function dtoName(entityName: string, suffix: string): string {
  return `${entityName}${suffix}`;
}

export function pascal(value: string): string {
  return toPascalCase(value);
}
