import type { EntityIR, ProjectIR } from "../ir/types";
import type { FieldIR } from "../ir/types";
import type { RelationIR } from "../ir/types";
import { ImportRegistry } from "../ir/imports";
import { sourceImport } from "./helpers";
import { ENUMS_PATH, entityDtoPath, entityFilePath, file, PAGINATION_PATH } from "./helpers";
import type { GeneratedFile } from "../ir/types";
import { validatorInfo } from "../ir/type-map";

const QUERY_RESERVED = new Set(["page", "limit", "search", "sort", "order", "withDeleted"]);

function exampleFor(field: FieldIR): string {
  const validators = field.definition.validators;
  if (field.enum) return JSON.stringify(field.enum.values[0] ?? "VALUE");

  switch (field.type) {
    case "string":
    case "text":
      if (field.name === "email") return "'user@example.com'";
      if (field.name === "name") return "'Ada Lovelace'";
      if (field.name === "title") return "'Hello world'";
      if (field.name === "slug") return "'hello-world'";
      return "'sample text'";
    case "int": {
      const value = validators?.min ?? 1;
      return String(Math.ceil(value));
    }
    case "float": {
      const value = validators?.min ?? 1.5;
      return String(value);
    }
    case "decimal":
      return "'1.00'";
    case "boolean":
      return "true";
    case "date":
      return "'2024-01-01'";
    case "datetime":
      return "'2024-01-01T00:00:00.000Z'";
    case "uuid":
      return "'00000000-0000-4000-8000-000000000000'";
    case "json":
      return "{}";
    default:
      return "'sample'";
  }
}

function apiProperty(field: FieldIR, optional: boolean): string {
  const parts: string[] = [];
  if (field.enum) {
    parts.push(`enum: ${field.enum.name}`);
  } else {
    switch (field.type) {
      case "int":
      case "float":
        parts.push("type: Number");
        break;
      case "decimal":
        parts.push("type: String");
        break;
      case "boolean":
        parts.push("type: Boolean");
        break;
      case "date":
        parts.push("type: String", "format: 'date'");
        break;
      case "datetime":
        parts.push("type: String", "format: 'date-time'");
        break;
      case "uuid":
        parts.push("type: String", "format: 'uuid'");
        break;
      case "json":
        parts.push("type: Object");
        break;
      default:
        parts.push("type: String");
        break;
    }
  }
  parts.push(`example: ${exampleFor(field)}`);
  const body = `{ ${parts.join(", ")} }`;
  return optional ? `@ApiPropertyOptional(${body})` : `@ApiProperty(${body})`;
}

export function scalarPropertyLines(
  field: FieldIR,
  registry: ImportRegistry,
  from: string,
  forceOptional = false,
  allowNull = true,
): string[] {
  const optional = forceOptional || !field.required || field.defaultValue !== undefined;
  registry.add("@nestjs/swagger", optional ? "ApiPropertyOptional" : "ApiProperty");
  const validators = validatorInfo(
    forceOptional ? { ...field.definition, required: false } : field.definition,
    field.enum?.name,
  );
  registry.add("class-validator", ...validators.imports);
  if (field.enum) registry.add(sourceImport(from, ENUMS_PATH), field.enum.name);

  const dateType = field.type === "date" || field.type === "datetime";
  const nullable = allowNull && dateType && !field.required;
  const dtoType = dateType ? (nullable ? "string | null" : "string") : field.tsType;
  return [
    `  ${apiProperty(field, optional)}`,
    ...validators.decorators.map((decorator) => `  ${decorator}`),
    `  ${field.name}${optional ? "?" : ""}: ${dtoType};`,
    "",
  ];
}

function relationFkPropertyLines(
  relation: RelationIR,
  registry: ImportRegistry,
): string[] {
  if (relation.owner || !relation.fkName) return [];
  const optional = relation.nullable;
  registry.add("@nestjs/swagger", optional ? "ApiPropertyOptional" : "ApiProperty");
  registry.add("class-validator", relation.fkType === "number" ? "IsInt" : "IsUUID", ...(optional ? ["IsOptional"] : []));
  const swagger =
    relation.fkType === "number"
      ? "{ type: Number, example: 1 }"
      : "{ type: String, format: 'uuid', example: '00000000-0000-4000-8000-000000000000' }";
  return [
    `  ${optional ? `@ApiPropertyOptional(${swagger})` : `@ApiProperty(${swagger})`}`,
    `  @${relation.fkType === "number" ? "IsInt" : "IsUUID"}()`,
    ...(optional ? ["  @IsOptional()"] : []),
    `  ${relation.fkName}${optional ? "?" : ""}: ${relation.fkType};`,
    "",
  ];
}

function manyToManyPropertyLines(relation: RelationIR, registry: ImportRegistry): string[] {
  const property = `${relation.name}Ids`;
  const itemType = relation.fkType === "number" ? "Number" : "String";
  registry.add("@nestjs/swagger", "ApiPropertyOptional");
  registry.add("class-validator", "IsArray", "IsOptional", relation.fkType === "number" ? "IsInt" : "IsUUID");
  const itemValidator =
    relation.fkType === "number" ? "@IsInt({ each: true })" : "@IsUUID(undefined, { each: true })";
  return [
    `  @ApiPropertyOptional({ type: [${itemType}] })`,
    "  @IsArray()",
    `  ${itemValidator}`,
    "  @IsOptional()",
    `  ${property}?: ${relation.fkType}[];`,
    "",
  ];
}

function numericQueryLines(field: FieldIR, registry: ImportRegistry): string[] {
  const integer = field.type === "int";
  registry.add("class-validator", integer ? "IsInt" : "IsNumber", "IsOptional");
  registry.add("class-transformer", "Type");
  const decorators = [
    "@Type(() => Number)",
    `@${integer ? "IsInt" : "IsNumber"}()`,
    "@IsOptional()",
  ];
  const properties = [field.name, `${field.name}Gte`, `${field.name}Lte`];
  const swagger =
    field.type === "decimal"
      ? "@ApiPropertyOptional({ type: Number, example: 1 })"
      : apiProperty(field, true);
  return properties.flatMap((property) => [
    `  ${swagger}`,
    ...decorators.map((decorator) => `  ${decorator}`),
    `  ${property}?: number;`,
    "",
  ]);
}

function dateQueryLines(field: FieldIR, registry: ImportRegistry): string[] {
  registry.add("class-validator", "IsDateString", "IsOptional");
  const properties = [field.name, `${field.name}Gte`, `${field.name}Lte`];
  const swagger =
    field.type === "decimal"
      ? "@ApiPropertyOptional({ type: Number, example: 1 })"
      : apiProperty(field, true);
  return properties.flatMap((property) => [
    `  ${swagger}`,
    "  @IsDateString()",
    "  @IsOptional()",
    `  ${property}?: string;`,
    "",
  ]);
}

function booleanQueryLines(field: FieldIR, registry: ImportRegistry): string[] {
  registry.add("class-validator", "IsBoolean", "IsOptional");
  registry.add("class-transformer", "Transform");
  return [
    `  ${apiProperty(field, true)}`,
    '  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === "true"))',
    "  @IsBoolean()",
    "  @IsOptional()",
    `  ${field.name}?: boolean;`,
    "",
  ];
}

function exactQueryLines(field: FieldIR, registry: ImportRegistry, from: string): string[] {
  if (field.type === "uuid") {
    registry.add("class-validator", "IsOptional", "IsUUID");
    return [
      `  ${apiProperty(field, true)}`,
      "  @IsUUID()",
      "  @IsOptional()",
      `  ${field.name}?: string;`,
      "",
    ];
  }

  if (field.enum) {
    registry.add("class-validator", "IsIn", "IsOptional");
    registry.add(sourceImport(from, ENUMS_PATH), field.enum.name);
    const values = field.enum.values.map((value) => JSON.stringify(value)).join(", ");
    return [
      `  ${apiProperty(field, true)}`,
      `  @IsIn([${values}])`,
      "  @IsOptional()",
      `  ${field.name}?: string;`,
      "",
    ];
  }

  registry.add("class-validator", "IsOptional", "IsString");
  return [
    `  ${apiProperty(field, true)}`,
    "  @IsString()",
    "  @IsOptional()",
    `  ${field.name}?: string;`,
    "",
  ];
}

function queryPropertyLines(field: FieldIR, registry: ImportRegistry, from: string): string[] {
  registry.add("@nestjs/swagger", "ApiPropertyOptional");
  if (field.type === "int" || field.type === "float" || field.type === "decimal") {
    return numericQueryLines(field, registry);
  }
  if (field.type === "date" || field.type === "datetime") {
    return dateQueryLines(field, registry);
  }
  if (field.type === "boolean") {
    return booleanQueryLines(field, registry);
  }
  return exactQueryLines(field, registry, from);
}

export function emitCreateDto(_ir: ProjectIR, entity: EntityIR): GeneratedFile {
  const path = entityDtoPath(entity, "create");
  const registry = new ImportRegistry();

  const lines: string[] = [];
  for (const field of entity.fields) {
    if (field.primary) continue;
    lines.push(...scalarPropertyLines(field, registry, path));
  }

  for (const relation of entity.relations) {
    if (relation.kind === "many-to-one" || relation.kind === "one-to-one") {
      lines.push(...relationFkPropertyLines(relation, registry));
    } else if (relation.kind === "many-to-many") {
      lines.push(...manyToManyPropertyLines(relation, registry));
    }
  }

  if (lines.length === 0) {
    lines.push("  // This entity has no writable fields.");
    lines.push("");
  }

  const content = `${registry.render()}export class Create${entity.name}Dto {\n${lines.join("\n")}}\n`;
  return file(path, content);
}

export function emitUpdateDto(entity: EntityIR): GeneratedFile {
  const path = entityDtoPath(entity, "update");
  const registry = new ImportRegistry();
  registry.add("@nestjs/swagger", "PartialType");
  registry.add(sourceImport(path, entityDtoPath(entity, "create")), `Create${entity.name}Dto`);

  const content = `${registry.render()}export class Update${entity.name}Dto extends PartialType(Create${entity.name}Dto) {}\n`;
  return file(path, content);
}

export function emitQueryDto(_ir: ProjectIR, entity: EntityIR): GeneratedFile {
  const path = entityDtoPath(entity, "query");
  const registry = new ImportRegistry();
  registry.add(sourceImport(path, PAGINATION_PATH), "PaginationQueryDto");

  const lines: string[] = [];
  for (const field of entity.fields) {
    if (field.primary || field.type === "json" || QUERY_RESERVED.has(field.name)) {
      continue;
    }
    lines.push(...queryPropertyLines(field, registry, path));
  }

  const content = `${registry.render()}export class Query${entity.name}Dto extends PaginationQueryDto {\n${lines.join("\n")}}\n`;
  return file(path, content);
}

export function emitPaginatedDto(entity: EntityIR): GeneratedFile {
  const path = `${entity.moduleDir}/dto/paginated-${entity.dtoPrefix}.dto.ts`;
  const registry = new ImportRegistry();
  registry.add("@nestjs/swagger", "ApiProperty");
  registry.add(sourceImport(path, entityFilePath(entity)), entity.name);
  const content = `${registry.render()}export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class Paginated${entity.name}Dto {
  @ApiProperty({ type: () => [${entity.name}] })
  data: ${entity.name}[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
`;
  return file(path, content);
}

export function emitEntityDtos(ir: ProjectIR, entity: EntityIR): GeneratedFile[] {
  return [
    emitCreateDto(ir, entity),
    emitUpdateDto(entity),
    emitQueryDto(ir, entity),
    ...(entity.options.pagination ? [emitPaginatedDto(entity)] : []),
  ];
}
