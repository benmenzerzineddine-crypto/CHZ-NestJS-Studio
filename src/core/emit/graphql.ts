import type { EntityIR, FieldIR, ProjectIR, RelationIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { validatorInfo } from "../ir/type-map";
import { toCamelCase, toPlural } from "../model/naming";
import {
  AUTH_CURRENT_USER_PATH,
  AUTH_PUBLIC_PATH,
  AUTH_ROLES_PATH,
  AUTH_USER_PATH,
  CURRENT_TENANT_PATH,
  ENUMS_PATH,
  entityFilePath,
  entityInputPath,
  entityResolverPath,
  entityServicePath,
  file,
  sourceImport,
} from "./helpers";
import type { GeneratedFile } from "../ir/types";
import type { AccessRule } from "../model/schema";

function inputFieldDecorator(field: FieldIR, registry: ImportRegistry, optional: boolean): string {
  registry.add("@nestjs/graphql", "@Field");
  const nullableOpt = optional ? ", { nullable: true }" : "";
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

function scalarInputLines(field: FieldIR, registry: ImportRegistry, from: string): string[] {
  const optional = !field.required || field.defaultValue !== undefined;
  const validators = validatorInfo(field.definition, field.enum?.name);
  registry.add("class-validator", ...validators.imports);
  if (field.enum) registry.add(sourceImport(from, ENUMS_PATH), field.enum.name);

  const dateType = field.type === "date" || field.type === "datetime";
  const inputType = dateType ? "Date" : field.tsType;
  return [
    `  ${inputFieldDecorator(field, registry, optional)}`,
    ...validators.decorators.map((decorator) => `  ${decorator}`),
    `  ${field.name}${optional ? "?" : ""}: ${inputType};`,
    "",
  ];
}

function relationFkInputLines(relation: RelationIR, registry: ImportRegistry): string[] {
  if (relation.owner || !relation.fkName) return [];
  const optional = relation.nullable;
  registry.add("@nestjs/graphql", "@Field", "@ID");
  registry.add(
    "class-validator",
    relation.fkType === "number" ? "IsInt" : "IsUUID",
    ...(optional ? ["IsOptional"] : []),
  );
  const gqlType = relation.fkType === "number" ? "Int" : "ID";
  if (relation.fkType === "number") registry.add("@nestjs/graphql", "Int");
  return [
    `  @Field(() => ${gqlType}${optional ? ", { nullable: true }" : ""})`,
    `  @${relation.fkType === "number" ? "IsInt" : "IsUUID"}()`,
    ...(optional ? ["  @IsOptional()"] : []),
    `  ${relation.fkName}${optional ? "?" : ""}: ${relation.fkType};`,
    "",
  ];
}

function manyToManyInputLines(relation: RelationIR, registry: ImportRegistry): string[] {
  const property = `${relation.name}Ids`;
  registry.add("@nestjs/graphql", "@Field", "@ID");
  registry.add(
    "class-validator",
    "IsArray",
    "IsOptional",
    relation.fkType === "number" ? "IsInt" : "IsUUID",
  );
  const gqlItem = relation.fkType === "number" ? "Int" : "ID";
  if (relation.fkType === "number") registry.add("@nestjs/graphql", "Int");
  const itemValidator =
    relation.fkType === "number"
      ? "@IsInt({ each: true })"
      : "@IsUUID(undefined, { each: true })";
  return [
    `  @Field(() => [${gqlItem}], { nullable: true })`,
    "  @IsArray()",
    `  ${itemValidator}`,
    "  @IsOptional()",
    `  ${property}?: ${relation.fkType}[];`,
    "",
  ];
}

export function emitCreateInput(_ir: ProjectIR, entity: EntityIR): GeneratedFile {
  const path = entityInputPath(entity, "create");
  const registry = new ImportRegistry();
  registry.add("@nestjs/graphql", "@InputType");

  const lines: string[] = [];
  for (const field of entity.fields) {
    if (field.primary) continue;
    lines.push(...scalarInputLines(field, registry, path));
  }
  for (const relation of entity.relations) {
    if (relation.kind === "many-to-one" || relation.kind === "one-to-one") {
      lines.push(...relationFkInputLines(relation, registry));
    } else if (relation.kind === "many-to-many") {
      lines.push(...manyToManyInputLines(relation, registry));
    }
  }

  const content = `${registry.render()}@InputType()
export class Create${entity.name}Input {
${lines.join("\n")}
}
`;
  return file(path, content);
}

export function emitUpdateInput(_ir: ProjectIR, entity: EntityIR): GeneratedFile {
  const path = entityInputPath(entity, "update");
  const createPath = entityInputPath(entity, "create");
  const registry = new ImportRegistry();
  registry.add("@nestjs/graphql", "@InputType", "PartialType");
  registry.add(sourceImport(path, createPath), `Create${entity.name}Input`);

  const content = `${registry.render()}@InputType()
export class Update${entity.name}Input extends PartialType(Create${entity.name}Input) {}
`;
  return file(path, content);
}

function accessDecoratorsForRule(
  rule: AccessRule,
  ir: ProjectIR,
  registry: ImportRegistry,
  path: string,
): string[] {
  if (!ir.auth.enabled) return [];
  if (rule.level === "public") {
    registry.add(sourceImport(path, AUTH_PUBLIC_PATH), "Public");
    return ["  @Public()"];
  }
  if (rule.level === "roles") {
    registry.add(sourceImport(path, AUTH_ROLES_PATH), "Roles");
    const roles = (rule.roles ?? []).map((r) => JSON.stringify(r)).join(", ");
    return [`  @Roles(${roles})`];
  }
  return [];
}

export function emitResolver(ir: ProjectIR, entity: EntityIR): GeneratedFile {
  const path = entityResolverPath(entity);
  const registry = new ImportRegistry();
  registry.add("@nestjs/graphql", "@Args", "@ID", "@Mutation", "@Query", "@Resolver");
  registry.add(sourceImport(path, entityFilePath(entity)), entity.name);
  registry.add(sourceImport(path, entityServicePath(entity)), `${entity.name}Service`);
  registry.add(
    sourceImport(path, entityInputPath(entity, "create")),
    `Create${entity.name}Input`,
  );
  registry.add(
    sourceImport(path, entityInputPath(entity, "update")),
    `Update${entity.name}Input`,
  );

  const needsUser = ir.auth.enabled;
  if (needsUser) {
    registry.add(sourceImport(path, AUTH_CURRENT_USER_PATH), "CurrentUser");
    registry.addType(sourceImport(path, AUTH_USER_PATH), "AuthUser");
  }
  if (entity.multitenant) {
    registry.add(sourceImport(path, CURRENT_TENANT_PATH), "CurrentTenant");
  }

  const params: string[] = [];
  const args: string[] = [];

  if (entity.multitenant) {
    params.push("@CurrentTenant() tenantId: string");
    args.push("tenantId");
  }
  if (needsUser) {
    params.push("@CurrentUser() user?: AuthUser");
    args.push("user");
  }

  const paramSignature = params.length > 0 ? params.join(", ") : "";
  const paramSignatureWithLeadingComma = params.length > 0 ? `, ${params.join(", ")}` : "";
  const callArgsWithLeadingComma = args.length > 0 ? `, ${args.join(", ")}` : "";

  const listAccess = accessDecoratorsForRule(entity.access.list, ir, registry, path);
  const readAccess = accessDecoratorsForRule(entity.access.read, ir, registry, path);
  const createAccess = accessDecoratorsForRule(entity.access.create, ir, registry, path);
  const updateAccess = accessDecoratorsForRule(entity.access.update, ir, registry, path);
  const deleteAccess = accessDecoratorsForRule(entity.access.delete, ir, registry, path);

  const singularCamel = toCamelCase(entity.name);
  const pluralCamel = toCamelCase(toPlural(entity.name));

  const lines: string[] = [];
  lines.push(`@Resolver(() => ${entity.name})`);
  lines.push(`export class ${entity.name}Resolver {`);
  lines.push(`  constructor(private readonly ${singularCamel}Service: ${entity.name}Service) {}`);
  lines.push("");

  // Query: findAll
  lines.push(`  @Query(() => [${entity.name}], { name: "${pluralCamel}" })`);
  if (listAccess.length > 0) lines.push(...listAccess);
  lines.push(`  async ${pluralCamel}(${paramSignature}): Promise<${entity.name}[]> {`);
  lines.push(`    const result = await this.${singularCamel}Service.findAll(undefined${callArgsWithLeadingComma});`);
  lines.push(`    return "items" in result ? result.items : result;`);
  lines.push("  }");
  lines.push("");

  // Query: findOne
  lines.push(`  @Query(() => ${entity.name}, { name: "${singularCamel}", nullable: true })`);
  if (readAccess.length > 0) lines.push(...readAccess);
  lines.push(
    `  async ${singularCamel}(@Args("id", { type: () => ID }) id: ${entity.primary.tsType}${paramSignatureWithLeadingComma}): Promise<${entity.name} | null> {`,
  );
  lines.push(`    return this.${singularCamel}Service.findOne(id${callArgsWithLeadingComma});`);
  lines.push("  }");
  lines.push("");

  // Mutation: create
  lines.push(`  @Mutation(() => ${entity.name}, { name: "create${entity.name}" })`);
  if (createAccess.length > 0) lines.push(...createAccess);
  lines.push(
    `  async create${entity.name}(@Args("input") input: Create${entity.name}Input${paramSignatureWithLeadingComma}): Promise<${entity.name}> {`,
  );
  lines.push(`    return this.${singularCamel}Service.create(input as any${callArgsWithLeadingComma});`);
  lines.push("  }");
  lines.push("");

  // Mutation: update
  lines.push(`  @Mutation(() => ${entity.name}, { name: "update${entity.name}" })`);
  if (updateAccess.length > 0) lines.push(...updateAccess);
  lines.push(
    `  async update${entity.name}(@Args("id", { type: () => ID }) id: ${entity.primary.tsType}, @Args("input") input: Update${entity.name}Input${paramSignatureWithLeadingComma}): Promise<${entity.name}> {`,
  );
  lines.push(`    return this.${singularCamel}Service.update(id, input as any${callArgsWithLeadingComma});`);
  lines.push("  }");
  lines.push("");

  // Mutation: remove
  lines.push(`  @Mutation(() => Boolean, { name: "remove${entity.name}" })`);
  if (deleteAccess.length > 0) lines.push(...deleteAccess);
  lines.push(
    `  async remove${entity.name}(@Args("id", { type: () => ID }) id: ${entity.primary.tsType}${paramSignatureWithLeadingComma}): Promise<boolean> {`,
  );
  lines.push(`    await this.${singularCamel}Service.remove(id${callArgsWithLeadingComma});`);
  lines.push("    return true;");
  lines.push("  }");

  if (entity.softDelete) {
    lines.push("");
    lines.push(`  @Mutation(() => Boolean, { name: "restore${entity.name}" })`);
    if (deleteAccess.length > 0) lines.push(...deleteAccess);
    lines.push(
      `  async restore${entity.name}(@Args("id", { type: () => ID }) id: ${entity.primary.tsType}${paramSignatureWithLeadingComma}): Promise<boolean> {`,
    );
    lines.push(`    await this.${singularCamel}Service.restore(id${callArgsWithLeadingComma});`);
    lines.push("    return true;");
    lines.push("  }");
  }

  lines.push("}");

  const content = `${registry.render()}${lines.join("\n")}\n`;
  return file(path, content);
}
