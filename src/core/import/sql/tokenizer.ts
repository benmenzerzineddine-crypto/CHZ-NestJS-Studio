/**
 * Strips comments and cleans SQL input
 */
export function cleanSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "") // multi-line comments
    .replace(/--.*$/gm, "") // single-line comments
    .trim();
}

/**
 * Extract PostgreSQL CREATE TYPE ... AS ENUM ('val1', 'val2')
 */
export function parseEnumDefinitions(sql: string): Map<string, string[]> {
  const enumMap = new Map<string, string[]>();
  const enumRegex = /CREATE\s+TYPE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?["`]?(\w+)["`]?\s+AS\s+ENUM\s*\(([^)]+)\)/gi;

  let match: RegExpExecArray | null;
  while ((match = enumRegex.exec(sql)) !== null) {
    const rawName = match[1];
    const rawValues = match[2];
    if (rawName && rawValues) {
      const values = rawValues
        .split(",")
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
      enumMap.set(rawName.toLowerCase(), values);
    }
  }

  return enumMap;
}

/**
 * Splits table body by commas that are not enclosed inside parentheses.
 */
export function splitSqlClauses(body: string): string[] {
  const lines: string[] = [];
  let current = "";
  let lineParenDepth = 0;

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === "(") lineParenDepth++;
    else if (char === ")") lineParenDepth--;
    else if (char === "," && lineParenDepth === 0) {
      lines.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}
