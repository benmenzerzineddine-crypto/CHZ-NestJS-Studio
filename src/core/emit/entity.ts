import type { ProjectIR, EntityIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { sourceImport } from "./helpers";
import { columnDecorator, primaryColumnDecorator } from "../ir/type-map";
import { entityFilePath, ENUMS_PATH, USER_ENTITY_PATH } from "./helpers";
import { renderStoredRelation, renderDerivedRelation } from "./entity-relations";
import { gqlFieldDecorator, renderAuthColumns, renderAuditColumns } from "./entity-columns";

interface RenderOptions {
  authColumns?: boolean;
}

export function renderEntityFile(
  ir: ProjectIR,
  entity: EntityIR,
  options: RenderOptions = {},
): { path: string; content: string } {
  const path = entity.isSystem ? USER_ENTITY_PATH : entityFilePath(entity);
  const registry = new ImportRegistry();
  const needsColumn =
    options.authColumns === true ||
    entity.multitenant ||
    entity.fields.some((field) => !field.primary) ||
    entity.relations.some((relation) => relation.fkName !== undefined);
  const needsIndex =
    entity.multitenant ||
    entity.fields.some((field) => !field.primary && field.indexed) ||
    entity.relations.some((relation) => relation.fkName !== undefined) ||
    Boolean(options.authColumns && (ir.auth.oauth?.google || ir.auth.oauth?.github));

  registry.add("typeorm", "@Entity", "@PrimaryGeneratedColumn");
  if (needsColumn) registry.add("typeorm", "@Column");
  if (needsIndex) registry.add("typeorm", "@Index");

  const hasRelations = entity.relations.length + entity.derivedRelations.length > 0;
  if (hasRelations) {
    const relationDecorators = new Set<string>();
    for (const relation of [...entity.relations, ...entity.derivedRelations]) {
      if (relation.kind === "many-to-one") relationDecorators.add("@ManyToOne");
      if (relation.kind === "one-to-many") relationDecorators.add("@OneToMany");
      if (relation.kind === "one-to-one") relationDecorators.add("@OneToOne");
      if (relation.kind === "many-to-many") relationDecorators.add("@ManyToMany");
    }
    registry.add("typeorm", ...relationDecorators);
    if (entity.relations.some((relation) => relation.fkName)) registry.add("typeorm", "@JoinColumn");
    if (entity.relations.some((relation) => relation.kind === "many-to-many")) registry.add("typeorm", "@JoinTable");
  }

  if (entity.timestamps) registry.add("typeorm", "@CreateDateColumn", "@UpdateDateColumn");
  if (entity.softDelete) registry.add("typeorm", "@DeleteDateColumn");
  if (options.authColumns) registry.add("class-transformer", "@Exclude");

  const lines: string[] = [];
  if (ir.graphql.enabled) {
    registry.add("@nestjs/graphql", "@ObjectType");
    lines.push("@ObjectType()");
  }
  lines.push(`@Entity('${entity.tableName}')`);
  lines.push(`export class ${entity.name} {`);

  for (const field of entity.fields) {
    if (field.primary) {
      if (ir.graphql.enabled) {
        registry.add("@nestjs/graphql", "@Field", "@ID");
        lines.push("  @Field(() => ID)");
      }
      lines.push(`  ${primaryColumnDecorator(field)}`);
      lines.push(`  ${field.name}: ${field.tsType};`);
      lines.push("");
      continue;
    }

    if (ir.graphql.enabled) {
      lines.push(`  ${gqlFieldDecorator(field, registry)}`);
    }
    if (field.indexed) lines.push("  @Index()");
    if (field.enum) {
      registry.add(sourceImport(path, ENUMS_PATH), field.enum.name);
    }
    lines.push(`  ${columnDecorator(field.definition, ir.driver, entity.tableName, field.enum?.name)}`);
    const nullableDate =
      (field.type === "date" || field.type === "datetime") && !field.required;
    const propertyType = nullableDate ? `${field.tsType} | null` : field.tsType;
    lines.push(`  ${field.name}${field.required ? "" : "?"}: ${propertyType};`);
    lines.push("");
  }

  if (options.authColumns) {
    lines.push(...renderAuthColumns(ir, registry));
  }

  lines.push(...renderAuditColumns(entity, ir, registry));

  for (const relation of entity.relations) {
    lines.push(...renderStoredRelation(entity, relation, ir, registry, path));
    lines.push("");
  }

  for (const derived of entity.derivedRelations) {
    lines.push(
      ...renderDerivedRelation(
        entity,
        derived.name,
        derived.kind,
        derived.source,
        derived.sourceRelation,
        registry,
        path,
        ir,
      ),
    );
    lines.push("");
  }

  lines.push("}");

  const content = `${registry.render()}${lines.join("\n")}\n`;
  return { path, content };
}

export function emitEntity(ir: ProjectIR, entity: EntityIR): { path: string; content: string } {
  return renderEntityFile(ir, entity, { authColumns: entity.isSystem });
}

export function emitEntities(ir: ProjectIR): string[] {
  return ir.entities
    .filter((entity) => !entity.isSystem)
    .map((entity) => emitEntity(ir, entity).path);
}
