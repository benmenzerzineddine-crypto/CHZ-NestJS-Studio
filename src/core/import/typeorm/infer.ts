import { createEnum } from "../../model/defaults";
import type { EnumDef, FieldType } from "../../model/schema";
import { toPascalCase } from "../naming";

export function inferTypeFromTsType(tsType: string): FieldType {
  const norm = tsType.trim().toLowerCase();
  if (norm === "string") return "string";
  if (norm === "number") return "int";
  if (norm === "boolean") return "boolean";
  if (norm === "date") return "datetime";
  if (norm.includes("[]") || norm.includes("record") || norm.includes("object") || norm === "any") {
    return "json";
  }
  return "string";
}

export function inferTypeFromColumnDecorator(optionsStr: string): {
  type: FieldType;
  nullable: boolean;
  unique: boolean;
  enumName?: string;
} {
  let type: FieldType = "string";
  let nullable = false;
  let unique = false;
  let enumName: string | undefined;

  const typeMatch = optionsStr.match(/type:\s*['"](\w+)['"]/i);
  if (typeMatch && typeMatch[1]) {
    const rawType = typeMatch[1].toLowerCase();
    if (rawType.includes("int") || rawType === "integer" || rawType === "smallint") type = "int";
    else if (rawType.includes("float") || rawType.includes("double") || rawType.includes("real")) type = "float";
    else if (rawType.includes("decimal") || rawType.includes("numeric")) type = "decimal";
    else if (rawType.includes("bool")) type = "boolean";
    else if (rawType === "uuid") type = "uuid";
    else if (rawType === "date") type = "date";
    else if (rawType.includes("time")) type = "datetime";
    else if (rawType.includes("json")) type = "json";
    else if (rawType.includes("text")) type = "text";
    else if (rawType === "enum") type = "enum";
  }

  if (/nullable:\s*true/.test(optionsStr)) nullable = true;
  if (/unique:\s*true/.test(optionsStr)) unique = true;

  const enumMatch = optionsStr.match(/enum:\s*(\w+)/i);
  if (enumMatch && enumMatch[1]) {
    type = "enum";
    enumName = toPascalCase(enumMatch[1]);
  }

  return { type, nullable, unique, enumName };
}

/**
 * Extracts TypeScript enums from code
 */
export function extractEnums(source: string): EnumDef[] {
  const enums: EnumDef[] = [];
  const enumRegex = /(?:export\s+)?enum\s+(\w+)\s*\{([^}]+)\}/g;

  let match: RegExpExecArray | null;
  while ((match = enumRegex.exec(source)) !== null) {
    const rawName = match[1];
    const body = match[2];
    if (rawName && body) {
      const values: string[] = [];
      const lines = body.split(",");
      for (const line of lines) {
        const val = line.trim();
        if (!val) continue;
        const eqIdx = val.indexOf("=");
        if (eqIdx !== -1) {
          const rawVal = val.substring(eqIdx + 1).trim().replace(/['"]/g, "");
          values.push(rawVal || val.substring(0, eqIdx).trim());
        } else {
          values.push(val);
        }
      }
      if (values.length > 0) {
        enums.push(createEnum(toPascalCase(rawName), values));
      }
    }
  }

  return enums;
}
