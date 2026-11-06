import { toSnakeCase } from "../model/naming";
import type { ProjectIR, EntityIR, FieldIR, RelationIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { sourceImport } from "./helpers";
import { columnDecorator, primaryColumnDecorator } from "../ir/type-map";
import { entityFilePath, ENUMS_PATH, USER_ENTITY_PATH } from "./helpers";

interface RenderOptions {
  authColumns?: boolean;
}

function typeImport(from: string, entity: EntityIR): string {
  return sourceImport(from, entityFilePath(entity));
}

function fkColumnOptions(
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

function onDelete(relation: RelationIR): string | undefined {
  if (relation.owner) return "CASCADE";
  if (relation.cascade) return "CASCADE";
  if (relation.nullable) return "SET NULL";
  return undefined;
}

function relationOptions(relation: RelationIR): string {
  const parts = [`nullable: ${relation.nullable ? "true" : "false"}`];
  const deleteAction = onDelete(relation);
  if (deleteAction) parts.push(`onDelete: '${deleteAction}'`);
  return `{ ${parts.join(", ")} }`;
}

function renderStoredRelation(
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

function gqlFieldDecorator(field: FieldIR, registry: ImportRegistry): string {
  registry.add("@nestjs/graphql", "@Field");
  const isNullable = !field.required;
  const nullableOpt = isNullable ? ", { nullable: true }" : "";
  switch (field.type) {
    case "int":
      registry.add("@nestjs/graphql", "Int");
      return `@Field(() => Int${nullableOpt})`;
    case "float":
    case "decimal":
      registry.add("@nestjs/graphql", "Float");
      return `@Field(() => Float${nullableOpt})`;
    case "boolean":
      return `@Field(() => Boolean${nullableOpt})`;
    case "date":
    case "datetime":
      return `@Field(() => Date${nullableOpt})`;
    case "uuid":
      registry.add("@nestjs/graphql", "ID");
      return `@Field(() => ID${nullableOpt})`;
    default:
      return `@Field(() => String${nullableOpt})`;
  }
}

function renderDerivedRelation(
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
    const hasOAuth = Boolean(ir.auth.oauth?.google || ir.auth.oauth?.github);
    lines.push("  @Exclude()");
    if (hasOAuth) {
      lines.push("  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true, select: false })");
      lines.push("  passwordHash?: string | null;");
    } else {
      lines.push("  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })");
      lines.push("  passwordHash: string;");
    }
    lines.push("");
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => [String])");
    }
    lines.push("  @Column({ name: 'roles', type: 'simple-array' })");
    lines.push("  roles: string[];");
    lines.push("");
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => Boolean)");
    }
    lines.push("  @Column({ name: 'is_active', type: 'boolean', default: true })");
    lines.push("  isActive: boolean;");
    lines.push("");
    if (ir.auth.emailVerification) {
      const dateType = ir.driver === "postgres" ? "timestamptz" : "datetime";
      if (ir.graphql.enabled) {
        registry.add("@nestjs/graphql", "@Field");
        lines.push("  @Field(() => Date, { nullable: true })");
      }
      lines.push(`  @Column({ name: 'email_verified_at', type: '${dateType}', nullable: true })`);
      lines.push("  emailVerifiedAt?: Date | null;");
      lines.push("");
    }
    if (ir.auth.oauth?.google) {
      lines.push("  @Index()");
      lines.push("  @Column({ name: 'google_id', type: 'varchar', length: 255, nullable: true })");
      lines.push("  googleId?: string | null;");
      lines.push("");
    }
    if (ir.auth.oauth?.github) {
      lines.push("  @Index()");
      lines.push("  @Column({ name: 'github_id', type: 'varchar', length: 255, nullable: true })");
      lines.push("  githubId?: string | null;");
      lines.push("");
    }
    if (hasOAuth) {
      if (ir.graphql.enabled) {
        registry.add("@nestjs/graphql", "@Field");
        lines.push("  @Field(() => String, { nullable: true })");
      }
      lines.push("  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })");
      lines.push("  avatarUrl?: string | null;");
      lines.push("");
    }
    if (ir.auth.twoFactor) {
      lines.push("  @Exclude()");
      lines.push("  @Column({ name: 'two_factor_secret', type: 'varchar', length: 255, nullable: true, select: false })");
      lines.push("  twoFactorSecret?: string | null;");
      lines.push("");
      lines.push("  @Column({ name: 'two_factor_enabled', type: 'boolean', default: false })");
      lines.push("  twoFactorEnabled: boolean;");
      lines.push("");
      lines.push("  @Exclude()");
      lines.push("  @Column({ name: 'two_factor_recovery_codes', type: 'simple-array', nullable: true, select: false })");
      lines.push("  twoFactorRecoveryCodes?: string[] | null;");
      lines.push("");
    }
  }

  if (entity.timestamps) {
    const dateType = ir.driver === "postgres" ? "timestamptz" : "datetime";
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => Date)");
    }
    lines.push(`  @CreateDateColumn({ name: 'created_at', type: '${dateType}' })`);
    lines.push("  createdAt: Date;");
    lines.push("");
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => Date)");
    }
    lines.push(`  @UpdateDateColumn({ name: 'updated_at', type: '${dateType}' })`);
    lines.push("  updatedAt: Date;");
    lines.push("");
  }

  if (entity.softDelete) {
    const dateType = ir.driver === "postgres" ? "timestamptz" : "datetime";
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => Date, { nullable: true })");
    }
    lines.push(`  @DeleteDateColumn({ name: 'deleted_at', type: '${dateType}', nullable: true })`);
    lines.push("  deletedAt?: Date;");
    lines.push("");
  }

  if (entity.multitenant) {
    if (ir.graphql.enabled) {
      registry.add("@nestjs/graphql", "@Field");
      lines.push("  @Field(() => String)");
    }
    lines.push("  @Index()");
    lines.push("  @Column({ name: 'tenant_id', type: 'varchar', length: 64 })");
    lines.push("  tenantId: string;");
    lines.push("");
  }

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

