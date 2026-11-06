import { toSnakeCase } from "../model/naming";
import type { Driver, FieldDef } from "../model/schema";

export interface ColumnMapping {
  tsType: string;
  columnType: string;
  length?: number;
  precision?: number;
  scale?: number;
}

const NUMERIC_TS_TYPES = new Set(["int", "float"]);

export function mapFieldType(field: FieldDef, driver: Driver, enumName?: string): ColumnMapping {
  switch (field.type) {
    case "string":
      return {
        tsType: "string",
        columnType: "varchar",
        length: field.column?.length ?? 255,
      };
    case "text":
      return { tsType: "string", columnType: "text" };
    case "int":
      return {
        tsType: "number",
        columnType: driver === "sqlite" ? "integer" : "int",
      };
    case "float":
      return {
        tsType: "number",
        columnType: driver === "postgres" ? "double precision" : driver === "mysql" ? "double" : "real",
      };
    case "decimal":
      return {
        tsType: "string",
        columnType: "decimal",
        precision: field.column?.precision,
        scale: field.column?.scale,
      };
    case "boolean":
      return { tsType: "boolean", columnType: "boolean" };
    case "date":
      return { tsType: "Date", columnType: "date" };
    case "datetime":
      return {
        tsType: "Date",
        columnType: driver === "postgres" ? "timestamptz" : "datetime",
      };
    case "uuid":
      return driver === "postgres"
        ? { tsType: "string", columnType: "uuid" }
        : { tsType: "string", columnType: "varchar", length: 36 };
    case "json":
      return {
        tsType: "Record<string, unknown>",
        columnType: driver === "sqlite" ? "simple-json" : driver === "postgres" ? "jsonb" : "json",
      };
    case "enum":
      return driver === "postgres"
        ? { tsType: enumName ?? "string", columnType: "enum" }
        : { tsType: enumName ?? "string", columnType: "varchar", length: 255 };
  }
}

export function typeScriptType(field: FieldDef, driver: Driver, enumName?: string): string {
  return mapFieldType(field, driver, enumName).tsType;
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export function defaultValueLiteral(field: FieldDef): string | undefined {
  if (field.defaultValue === undefined) return undefined;
  const value = field.defaultValue;

  if (field.type === "boolean") {
    if (value === "true" || value === "1") return "true";
    if (value === "false" || value === "0") return "false";
    return quote(value);
  }

  if (NUMERIC_TS_TYPES.has(field.type) || field.type === "decimal") {
    return /^-?\d+(\.\d+)?$/.test(value) ? value : quote(value);
  }

  if (field.type === "json") return undefined;
  return quote(value);
}

export function columnOptions(
  field: FieldDef,
  driver: Driver,
  tableName: string,
  enumName?: string,
): string {
  const mapping = mapFieldType(field, driver, enumName);
  const parts: string[] = [];

  if (field.type === "enum" && driver === "postgres" && enumName) {
    parts.push(`type: 'enum'`, `enum: ${enumName}`, `enumName: '${tableName}_${field.name}'`);
  } else {
    parts.push(`type: '${mapping.columnType}'`);
    if (mapping.length !== undefined) parts.push(`length: ${mapping.length}`);
    if (mapping.precision !== undefined) parts.push(`precision: ${mapping.precision}`);
    if (mapping.scale !== undefined) parts.push(`scale: ${mapping.scale}`);
  }

  parts.push(`name: '${toSnakeCase(field.name)}'`);
  parts.push(`nullable: ${field.required ? "false" : "true"}`);
  if (field.unique) parts.push("unique: true");

  const defaultValue = defaultValueLiteral(field);
  if (defaultValue !== undefined) parts.push(`default: ${defaultValue}`);

  return `{ ${parts.join(", ")} }`;
}

export function columnDecorator(
  field: FieldDef,
  driver: Driver,
  tableName: string,
  enumName?: string,
): string {
  return `@Column(${columnOptions(field, driver, tableName, enumName)})`;
}

export function primaryColumnDecorator(field: FieldDef): string {
  const name = `name: '${toSnakeCase(field.name)}'`;
  return field.type === "int"
    ? `@PrimaryGeneratedColumn({ ${name} })`
    : `@PrimaryGeneratedColumn('uuid', { ${name} })`;
}

export interface ValidatorInfo {
  decorators: string[];
  imports: string[];
}

export function validatorInfo(field: FieldDef, enumName?: string): ValidatorInfo {
  const decorators: string[] = [];
  const imports = new Set<string>();

  const optional = !field.required || field.defaultValue !== undefined;
  if (optional) {
    decorators.push("@IsOptional()");
    imports.add("IsOptional");
  }

  switch (field.type) {
    case "string":
    case "text": {
      decorators.push("@IsString()");
      imports.add("IsString");
      const maxLength = field.validators?.maxLength ?? (field.type === "string" ? field.column?.length ?? 255 : undefined);
      if (maxLength !== undefined) {
        decorators.push(`@MaxLength(${maxLength})`);
        imports.add("MaxLength");
      }
      if (field.validators?.minLength !== undefined) {
        decorators.push(`@MinLength(${field.validators.minLength})`);
        imports.add("MinLength");
      }
      if (field.validators?.pattern) {
        decorators.push(`@Matches(new RegExp(${JSON.stringify(field.validators.pattern)}))`);
        imports.add("Matches");
      }
      break;
    }
    case "int":
      decorators.push("@IsInt()");
      imports.add("IsInt");
      if (field.validators?.min !== undefined) {
        decorators.push(`@Min(${field.validators.min})`);
        imports.add("Min");
      }
      if (field.validators?.max !== undefined) {
        decorators.push(`@Max(${field.validators.max})`);
        imports.add("Max");
      }
      break;
    case "float":
      decorators.push("@IsNumber()");
      imports.add("IsNumber");
      if (field.validators?.min !== undefined) {
        decorators.push(`@Min(${field.validators.min})`);
        imports.add("Min");
      }
      if (field.validators?.max !== undefined) {
        decorators.push(`@Max(${field.validators.max})`);
        imports.add("Max");
      }
      break;
    case "decimal":
      decorators.push("@IsNumberString()");
      imports.add("IsNumberString");
      break;
    case "boolean":
      decorators.push("@IsBoolean()");
      imports.add("IsBoolean");
      break;
    case "date":
    case "datetime":
      decorators.push("@IsDateString()");
      imports.add("IsDateString");
      break;
    case "uuid":
      decorators.push("@IsUUID()");
      imports.add("IsUUID");
      break;
    case "json":
      decorators.push("@IsObject()");
      imports.add("IsObject");
      break;
    case "enum":
      decorators.push(`@IsEnum(${enumName ?? "String"})`);
      imports.add("IsEnum");
      break;
  }

  return { decorators, imports: [...imports] };
}

export function foreignKeyValidator(targetType: "string" | "number", optional = true): string[] {
  return optional
    ? [targetType === "number" ? "@IsInt()" : "@IsUUID()", "@IsOptional()"]
    : [targetType === "number" ? "@IsInt()" : "@IsUUID()"];
}
