import { toSnakeCase } from "../model/naming";
import type { ProjectIR, EntityIR, RelationIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { sourceImport, entityFilePath } from "./helpers";

export function typeImport(from: string, entity: EntityIR): string {
  return sourceImport(from, entityFilePath(entity));
}

export function fkColumnOptions(
  relation: RelationIR,
  ir: ProjectIR,
): string {
  const target = relation.target.primary;
  const type = target.type === "int" ? (ir.driver === "sqlite" ? "integer" : "int") : ir.driver === "postgres" ? "uuid" : "varchar";
  const parts = [`name: '${toSnakeCase(relation.fkName ?? `${relation.name}Id`)}'`, `type: '${type}'`];
  if (target.type !== "int" && ir.driver !== "postgres") parts.push("length: 36");
  parts.push(`nullable: ${relation.nullable ? "true" : "false"}`);
  return `{ ${parts.join(", ")} }`;
}

export function onDelete(relation: RelationIR): string | undefined {
  if (relation.owner) return "CASCADE";
  if (relation.cascade) return "CASCADE";
  if (relation.nullable) return "SET NULL";
  return undefined;
}

export function relationOptions(relation: RelationIR): string {
  const parts = [`nullable: ${relation.nullable ? "true" : "false"}`];
  const deleteAction = onDelete(relation);
  if (deleteAction) parts.push(`onDelete: '${deleteAction}'`);
  return `{ ${parts.join(", ")} }`;
}

export function renderStoredRelation(
  entity: EntityIR,
  relation: RelationIR,
  ir: ProjectIR,
  registry: ImportRegistry,
  from: string,
): string[] {
  const lines: string[] = [];
  const targetName = relation.target.name;
  const targetType = relation.kind === "many-to-many" ? `${targetName}[]` : targetName;
  const propertyType = relation.nullable && relation.kind !== "many-to-many" ? `${targetType} | null` : targetType;

  if (relation.fkName) {
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field", "@ID");
      lines.push(`  @Field(() => ID${relation.nullable ? ", { nullable: true }" : ""})`);
    }
    lines.push("@Index()");
    lines.push(`@Column(${fkColumnOptions(relation, ir)})`);
    lines.push(`${relation.fkName}${relation.nullable ? "?" : ""}: ${relation.fkType};`);
    lines.push("");
  }

  if (relation.target.id !== entity.id) {
    if (ir.graphql.enabled) {
      registry.add(typeImport(from, relation.target), targetName);
    } else {
      registry.addType(typeImport(from, relation.target), targetName);
    }
  }

  const gqlRelationType = relation.kind === "many-to-many" ? `[${targetName}]` : targetName;
  if (relation.kind === "many-to-one") {
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push(`  @Field(() => ${gqlRelationType}, { nullable: true })`);
    }
    lines.push(`@ManyToOne('${targetName}', ${relationOptions(relation)})`);
    lines.push(
      `@JoinColumn({ name: '${toSnakeCase(relation.fkName ?? relation.name)}', referencedColumnName: '${relation.target.primary.columnName}' })`,
    );
    lines.push(`${relation.name}${relation.nullable ? "?" : ""}: ${propertyType};`);
  } else if (relation.kind === "one-to-one") {
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push(`  @Field(() => ${gqlRelationType}, { nullable: true })`);
    }
    lines.push(`@OneToOne('${targetName}', ${relationOptions(relation)})`);
    lines.push(
      `@JoinColumn({ name: '${toSnakeCase(relation.fkName ?? relation.name)}', referencedColumnName: '${relation.target.primary.columnName}' })`,
    );
    lines.push(`${relation.name}${relation.nullable ? "?" : ""}: ${propertyType};`);
  } else if (relation.kind === "many-to-many") {
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push(`  @Field(() => ${gqlRelationType}, { nullable: true })`);
    }
    lines.push(`@ManyToMany('${targetName}')`);
    lines.push(
      `@JoinTable({ name: '${relation.joinTableName}', joinColumn: { name: '${toSnakeCase(relation.joinColumnName ?? "sourceId")}', referencedColumnName: '${entity.primary.columnName}' }, inverseJoinColumn: { name: '${toSnakeCase(relation.inverseJoinColumnName ?? "targetId")}', referencedColumnName: '${relation.target.primary.columnName}' } })`,
    );
    lines.push(`${relation.name}: ${targetType};`);
  }

  return lines;
}

export function renderDerivedRelation(
  entity: EntityIR,
  name: string,
  kind: RelationIR["kind"],
  source: EntityIR,
  sourceRelation: RelationIR,
  registry: ImportRegistry,
  from: string,
  ir: ProjectIR,
): string[] {
  const lines: string[] = [];
  if (source.id !== entity.id) {
    if (ir.graphql.enabled) {
      registry.add(typeImport(from, source), source.name);
    } else {
      registry.addType(typeImport(from, source), source.name);
    }
  }

  const isArray = kind === "one-to-many" || kind === "many-to-many";
  const gqlType = isArray ? `[${source.name}]` : source.name;
  if (ir.graphql.enabled) {
    registry.add("@nestjs/graphql", "@Field");
    lines.push(`  @Field(() => ${gqlType}, { nullable: true })`);
  }

  if (kind === "one-to-many") {
    lines.push(`@OneToMany('${source.name}', '${sourceRelation.name}')`);
    lines.push(`${name}: ${source.name}[];`);
  } else if (kind === "many-to-one") {
    lines.push(`@ManyToOne('${source.name}')`);
    lines.push(`${name}: ${source.name};`);
  } else if (kind === "one-to-one") {
    lines.push(`@OneToOne('${source.name}', '${sourceRelation.name}')`);
    lines.push(`${name}?: ${source.name};`);
  } else {
    lines.push(`@ManyToMany('${source.name}', '${sourceRelation.name}')`);
    lines.push(`${name}: ${source.name}[];`);
  }

  return lines;
}
