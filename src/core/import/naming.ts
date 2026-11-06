/**
 * Naming normalization helpers for schema import.
 * Maps SQL table names and TypeORM class names to valid PascalCase Entity names,
 * and SQL column names to valid camelCase Field names.
 */

export function toCamelCase(input: string): string {
  const cleaned = input.replace(/[`"'[\]]/g, "").trim();
  if (!/[-_\s]/.test(cleaned)) {
    return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }
  const parts = cleaned.split(/[-_\s]+/);
  if (parts.length === 0 || !parts[0]) return "field";

  const first = parts[0].toLowerCase();
  const rest = parts
    .slice(1)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  const result = `${first}${rest}`;
  return /^[a-z]/.test(result) ? result : `f_${result}`;
}

export function toPascalCase(input: string): string {
  const cleaned = input.replace(/[`"'[\]]/g, "").trim();
  if (!/[-_\s]/.test(cleaned)) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  const parts = cleaned.split(/[-_\s]+/);
  const result = parts
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

  return /^[A-Z]/.test(result) ? result : `E${result}`;
}

/**
 * Basic plural-to-singular converter for table names to entity names.
 */
export function singularize(word: string): string {
  const lower = word.toLowerCase();

  // Irregular / common plurals
  if (lower === "people") return "Person";
  if (lower === "children") return "Child";
  if (lower === "data") return "Datum";

  // Common suffix rules
  if (lower.endsWith("ies") && lower.length > 3) {
    return word.slice(0, -3) + (word.endsWith("IES") ? "Y" : "y");
  }
  if (
    (lower.endsWith("ses") ||
      lower.endsWith("xes") ||
      lower.endsWith("shes") ||
      lower.endsWith("ches")) &&
    lower.length > 4
  ) {
    return word.slice(0, -2);
  }
  if (lower.endsWith("status")) {
    return word;
  }
  if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 2) {
    return word.slice(0, -1);
  }

  return word;
}

export function toEntityName(tableName: string): string {
  // Strip common table prefixes like tbl_, t_
  let clean = tableName.replace(/[`"'[\]]/g, "").trim();
  if (/^tbl_/i.test(clean)) clean = clean.substring(4);
  else if (/^t_/i.test(clean)) clean = clean.substring(2);

  // Split and singularize the last token
  const parts = clean.split(/[-_\s]+/);
  if (parts.length > 0) {
    const lastIndex = parts.length - 1;
    parts[lastIndex] = singularize(parts[lastIndex]);
  }

  return toPascalCase(parts.join("_"));
}

export function toFieldName(columnName: string): string {
  return toCamelCase(columnName);
}

export function toEnumName(name: string): string {
  const pascal = toPascalCase(name);
  return pascal.endsWith("Enum") ? pascal : `${pascal}Enum`;
}
