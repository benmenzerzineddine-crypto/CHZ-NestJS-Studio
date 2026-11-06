import type { FieldType } from "../../model/schema";

export function parseSqlType(rawType: string): {
  type: FieldType;
  enumValues?: string[];
} {
  const norm = rawType.trim().toLowerCase();

  if (norm.startsWith("enum")) {
    const match = norm.match(/enum\s*\(([^)]+)\)/i);
    if (match && match[1]) {
      const values = match[1]
        .split(",")
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
      return { type: "enum", enumValues: values };
    }
    return { type: "enum" };
  }

  if (
    norm.includes("serial") ||
    norm.includes("int") ||
    norm === "integer" ||
    norm === "smallint" ||
    norm === "tinyint" ||
    norm === "bigint"
  ) {
    return { type: "int" };
  }

  if (norm.includes("float") || norm.includes("real") || norm.includes("double")) {
    return { type: "float" };
  }

  if (norm.includes("decimal") || norm.includes("numeric") || norm.includes("money")) {
    return { type: "decimal" };
  }

  if (norm.includes("bool")) {
    return { type: "boolean" };
  }

  if (norm === "uuid") {
    return { type: "uuid" };
  }

  if (norm === "date") {
    return { type: "date" };
  }

  if (norm.includes("time") || norm.includes("date")) {
    return { type: "datetime" };
  }

  if (norm.includes("json")) {
    return { type: "json" };
  }

  if (norm.includes("text") || norm.includes("clob")) {
    return { type: "text" };
  }

  return { type: "string" };
}
