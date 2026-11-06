import {
  createEntity,
  createField,
  createRelation,
  createEnum,
  createProject,
  USER_ENTITY_ID,
  AUTH_RESERVED_FIELD_NAMES,
} from "../model/defaults";
import type {
  Driver,
  EntityDef,
  EnumDef,
  FieldDef,
  FieldType,
  Project,
  RelationDef,
} from "../model/schema";
import { toCamelCase, toEntityName, toEnumName, toFieldName } from "./naming";

interface ParsedColumn {
  name: string;
  type: FieldType;
  enumName?: string;
  enumValues?: string[];
  required: boolean;
  unique: boolean;
  primary: boolean;
  reference?: {
    table: string;
    column: string;
    cascade?: boolean;
  };
}

interface ParsedTable {
  rawName: string;
  entityName: string;
  columns: ParsedColumn[];
  foreignKeys: Array<{
    column: string;
    targetTable: string;
    targetColumn: string;
    cascade?: boolean;
  }>;
  primaryKeys: string[];
}

export interface SqlImportOptions {
  projectName?: string;
  driver?: Driver;
  defaultAuth?: boolean;
}

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

/**
 * Strips comments and clean SQL input
 */
function cleanSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "") // multi-line comments
    .replace(/--.*$/gm, "") // single-line comments
    .trim();
}

/**
 * Extract PostgreSQL CREATE TYPE ... AS ENUM ('val1', 'val2')
 */
function parseEnumDefinitions(sql: string): Map<string, string[]> {
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

export function parseSqlDdl(sql: string, options: SqlImportOptions = {}): Project {
  const cleaned = cleanSql(sql);
  const globalEnums = parseEnumDefinitions(cleaned);

  const tables: ParsedTable[] = [];

  // Match CREATE TABLE [IF NOT EXISTS] [schema.]table_name (
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?\s*\(/gi;

  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(cleaned)) !== null) {
    const rawTableName = match[1];
    if (!rawTableName) continue;

    const startIndex = match.index + match[0].length;
    let parenDepth = 1;
    let endIndex = startIndex;

    while (endIndex < cleaned.length && parenDepth > 0) {
      const char = cleaned[endIndex];
      if (char === "(") parenDepth++;
      else if (char === ")") parenDepth--;
      endIndex++;
    }

    if (parenDepth !== 0) continue;
    const body = cleaned.substring(startIndex, endIndex - 1);
    tableRegex.lastIndex = endIndex;

    const table: ParsedTable = {
      rawName: rawTableName,
      entityName: toEntityName(rawTableName),
      columns: [],
      foreignKeys: [],
      primaryKeys: [],
    };

    // Split body by commas that are not inside parentheses
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

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Table-level PRIMARY KEY (col1, col2)
      const pkMatch = trimmed.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch && pkMatch[1]) {
        const pkCols = pkMatch[1].split(",").map((c) => c.trim().replace(/[`"']/g, ""));
        table.primaryKeys.push(...pkCols);
        continue;
      }

      // Table-level FOREIGN KEY (col) REFERENCES target (target_col)
      const fkMatch = trimmed.match(
        /(?:CONSTRAINT\s+["`]?\w+["`]?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|RESTRICT|SET\s+NULL))?/i,
      );
      if (fkMatch && fkMatch[1] && fkMatch[2] && fkMatch[3]) {
        const col = fkMatch[1].trim().replace(/[`"']/g, "");
        const targetTable = fkMatch[2].trim().replace(/[`"']/g, "");
        const targetCol = fkMatch[3].trim().replace(/[`"']/g, "");
        const action = fkMatch[4]?.toUpperCase();

        table.foreignKeys.push({
          column: col,
          targetTable,
          targetColumn: targetCol,
          cascade: action === "CASCADE",
        });
        continue;
      }

      // Skip general indexes or constraints
      if (/^(?:CONSTRAINT|KEY|INDEX|CHECK|UNIQUE\s*\()/i.test(trimmed)) {
        continue;
      }

      // Parse column: name type [modifiers]
      const colTokens = trimmed.split(/\s+/);
      if (colTokens.length < 2) continue;

      const rawColName = colTokens[0].replace(/[`"']/g, "");
      const rawColType = colTokens[1];

      // Reconstruct rest of column declaration
      const rest = trimmed.substring(colTokens[0].length).trim();
      const upperRest = rest.toUpperCase();

      const isPrimary = upperRest.includes("PRIMARY KEY") || upperRest.includes("AUTO_INCREMENT");
      const isRequired = isPrimary || /\bNOT\s+NULL\b/i.test(rest);
      const isUnique = /\bUNIQUE\b/i.test(rest);

      let { type, enumValues } = parseSqlType(rawColType);
      let enumName: string | undefined;

      // Check if type matches a global CREATE TYPE enum
      const customEnumValues = globalEnums.get(rawColType.toLowerCase());
      if (customEnumValues) {
        type = "enum";
        enumValues = customEnumValues;
        enumName = toEnumName(rawColType);
      } else if (type === "enum" && enumValues) {
        enumName = toEnumName(`${rawTableName}_${rawColName}`);
      }

      // Check inline references: REFERENCES target(col)
      let reference: { table: string; column: string; cascade?: boolean } | undefined;
      const inlineRef = rest.match(/REFERENCES\s+(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|RESTRICT|SET\s+NULL))?/i);
      if (inlineRef && inlineRef[1] && inlineRef[2]) {
        reference = {
          table: inlineRef[1].replace(/[`"']/g, ""),
          column: inlineRef[2].replace(/[`"']/g, ""),
          cascade: inlineRef[3]?.toUpperCase() === "CASCADE",
        };
      }

      table.columns.push({
        name: rawColName,
        type,
        enumName,
        enumValues,
        required: isRequired,
        unique: isUnique,
        primary: isPrimary,
        reference,
      });

      if (isPrimary) {
        table.primaryKeys.push(rawColName);
      }
    }

    tables.push(table);
  }

  // Also check external ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...
  const alterFkRegex = /ALTER\s+TABLE\s+(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?\s+ADD\s+(?:CONSTRAINT\s+["`]?\w+["`]?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:["`]?\w+["`]?\.)?["`]?(\w+)["`]?\s*\(([^)]+)\)/gi;

  while ((match = alterFkRegex.exec(cleaned)) !== null) {
    const srcTable = match[1];
    const srcCol = match[2];
    const tgtTable = match[3];
    const tgtCol = match[4];

    if (srcTable && srcCol && tgtTable && tgtCol) {
      const foundTable = tables.find((t) => t.rawName.toLowerCase() === srcTable.toLowerCase());
      if (foundTable) {
        foundTable.foreignKeys.push({
          column: srcCol.trim().replace(/[`"']/g, ""),
          targetTable: tgtTable.trim().replace(/[`"']/g, ""),
          targetColumn: tgtCol.trim().replace(/[`"']/g, ""),
        });
      }
    }
  }

  // Construct the chz-nest Project
  const projectName = options.projectName || "Imported API";
  const project = createProject(projectName);
  project.driver = options.driver || "postgres";
  if (options.defaultAuth === false) {
    project.auth.enabled = false;
  }

  const enums: EnumDef[] = [];
  const enumKeyMap = new Map<string, string>(); // enumName -> enumId

  // Register all global CREATE TYPE enums
  for (const [rawEnumName, values] of globalEnums.entries()) {
    const enumName = toEnumName(rawEnumName);
    if (!enumKeyMap.has(enumName)) {
      const enm = createEnum(enumName, values);
      enums.push(enm);
      enumKeyMap.set(enumName, enm.id);
    }
  }

  // Register inline enums from tables
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.type === "enum" && col.enumValues && col.enumName) {
        if (!enumKeyMap.has(col.enumName)) {
          const enm = createEnum(col.enumName, col.enumValues);
          enums.push(enm);
          enumKeyMap.set(col.enumName, enm.id);
        }
      }
    }
  }

  // Build entities
  const entityMap = new Map<string, EntityDef>(); // rawTableName.toLowerCase() -> EntityDef

  for (const table of tables) {
    const isUser = table.entityName.toLowerCase() === "user";
    const entity = isUser
      ? project.entities.find((e) => e.id === USER_ENTITY_ID)!
      : createEntity(table.entityName);

    let hasCreatedAt = false;
    let hasUpdatedAt = false;
    let hasDeletedAt = false;

    // Detect fields
    for (const col of table.columns) {
      const lower = col.name.toLowerCase();

      // Check standard timestamps / soft delete
      if (lower === "created_at" || lower === "createdat") {
        hasCreatedAt = true;
        continue;
      }
      if (lower === "updated_at" || lower === "updatedat") {
        hasUpdatedAt = true;
        continue;
      }
      if (lower === "deleted_at" || lower === "deletedat") {
        hasDeletedAt = true;
        continue;
      }

      // Check if this column is a foreign key
      const isFk =
        table.foreignKeys.some((fk) => fk.column.toLowerCase() === lower) ||
        Boolean(col.reference);

      if (isFk) {
        continue;
      }

      // Check if column is reserved auth field if table is user
      if (
        table.entityName.toLowerCase() === "user" &&
        AUTH_RESERVED_FIELD_NAMES.includes(col.name as (typeof AUTH_RESERVED_FIELD_NAMES)[number])
      ) {
        continue;
      }

      const fieldName = toFieldName(col.name);
      const isPk = col.primary || table.primaryKeys.includes(col.name);

      const fieldDef: FieldDef = createField(fieldName, col.type, {
        required: col.required,
        unique: col.unique,
        primary: isPk,
        enumId: col.enumName ? enumKeyMap.get(col.enumName) : undefined,
      });

      // Avoid duplicate field names
      if (!entity.fields.some((f) => f.name === fieldDef.name)) {
        entity.fields.push(fieldDef);
      }
    }

    entity.options.timestamps = hasCreatedAt && hasUpdatedAt;
    entity.options.softDelete = hasDeletedAt;

    entityMap.set(table.rawName.toLowerCase(), entity);
    if (table.rawName.toLowerCase() === "users") {
      entityMap.set("user", entity);
    } else if (table.rawName.toLowerCase() === "user") {
      entityMap.set("users", entity);
    }
  }

  // Build Relations between entities
  for (const table of tables) {
    const sourceEntity = entityMap.get(table.rawName.toLowerCase());
    if (!sourceEntity) continue;

    // Collect all foreign keys (table level + inline)
    const allFks = [...table.foreignKeys];
    for (const col of table.columns) {
      if (col.reference) {
        allFks.push({
          column: col.name,
          targetTable: col.reference.table,
          targetColumn: col.reference.column,
          cascade: col.reference.cascade,
        });
      }
    }

    for (const fk of allFks) {
      const targetEntity = entityMap.get(fk.targetTable.toLowerCase());
      if (!targetEntity) continue;

      // Clean relation name from column (e.g., author_id -> author, post_id -> post)
      let relName = fk.column.replace(/_id$/i, "").replace(/Id$/, "");
      relName = toCamelCase(relName);
      if (!relName || relName === "id") {
        relName = toCamelCase(targetEntity.name);
      }

      const relation: RelationDef = createRelation(
        relName,
        targetEntity.id,
        "many-to-one",
        {
          nullable: !table.columns.find((c) => c.name.toLowerCase() === fk.column.toLowerCase())?.required,
          cascade: fk.cascade ?? false,
        },
      );

      if (!sourceEntity.relations.some((r) => r.name === relation.name)) {
        sourceEntity.relations.push(relation);
      }

      // Check if target is user and can be owner
      if (targetEntity.name.toLowerCase() === "user" && (relName === "user" || relName === "owner" || relName === "author")) {
        sourceEntity.options.owner = true;
        sourceEntity.options.ownerRelation = relName;
      }
    }
  }

  // Add non-user entities to project
  for (const [rawName, entity] of entityMap.entries()) {
    if (rawName !== "user" && rawName !== "users" && !project.entities.some((e) => e.id === entity.id)) {
      project.entities.push(entity);
    }
  }

  // If an entity does not have an owner relation, default update operation to authenticated
  for (const entity of project.entities) {
    if (!entity.options.owner && entity.access.update.level === "owner") {
      entity.access.update = { level: "authenticated" };
    }
  }

  project.enums = enums;
  return project;
}
