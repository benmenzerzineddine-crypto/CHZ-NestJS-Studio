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
  FieldType,
  Project,
  RelationKind,
} from "../model/schema";
import { toPascalCase } from "./naming";

export interface TypeOrmImportOptions {
  projectName?: string;
  driver?: Driver;
  defaultAuth?: boolean;
}

interface ParsedTypeOrmField {
  name: string;
  type: FieldType;
  enumName?: string;
  required: boolean;
  unique: boolean;
  primary: boolean;
}

interface ParsedTypeOrmRelation {
  name: string;
  targetClassName: string;
  kind: RelationKind;
  nullable: boolean;
  cascade: boolean;
}

interface ParsedTypeOrmEntity {
  className: string;
  tableName: string;
  fields: ParsedTypeOrmField[];
  relations: ParsedTypeOrmRelation[];
  hasTimestamps: boolean;
  hasSoftDelete: boolean;
}

function inferTypeFromTsType(tsType: string): FieldType {
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

function inferTypeFromColumnDecorator(optionsStr: string): {
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
function extractEnums(source: string): EnumDef[] {
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

export function parseTypeOrmSource(source: string, options: TypeOrmImportOptions = {}): Project {
  const enums = extractEnums(source);
  const enumMap = new Map<string, string>();
  for (const enm of enums) {
    enumMap.set(enm.name, enm.id);
  }

  const entities: ParsedTypeOrmEntity[] = [];

  // Match class with optional @Entity() decorator
  const classRegex = /(?:@Entity\s*\(\s*(?:['"](\w+)['"])?\s*\)\s*)?(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{([\s\S]*?)\n\s*\}/g;

  let classMatch: RegExpExecArray | null;
  while ((classMatch = classRegex.exec(source)) !== null) {
    const rawTableName = classMatch[1];
    const className = classMatch[2];
    const body = classMatch[3];

    if (!className || !body) continue;

    const parsedEntity: ParsedTypeOrmEntity = {
      className,
      tableName: rawTableName || className,
      fields: [],
      relations: [],
      hasTimestamps: false,
      hasSoftDelete: false,
    };

    // Parse member lines
    const propertyRegex = /(?:@([A-Za-z0-9]+)\s*\(([\s\S]*?)\)\s*)*(?:@([A-Za-z0-9]+)\s*\(([\s\S]*?)\)\s*)*(\w+)(?:\?)?:\s*([^;]+);/g;

    let propMatch: RegExpExecArray | null;
    while ((propMatch = propertyRegex.exec(body)) !== null) {
      const fullMatch = propMatch[0];
      const propName = propMatch[5];
      const rawTsType = propMatch[6]?.trim() || "string";

      if (!propName) continue;

      if (fullMatch.includes("@CreateDateColumn") || fullMatch.includes("@UpdateDateColumn")) {
        parsedEntity.hasTimestamps = true;
        continue;
      }
      if (fullMatch.includes("@DeleteDateColumn")) {
        parsedEntity.hasSoftDelete = true;
        continue;
      }

      // Check PrimaryGeneratedColumn
      if (fullMatch.includes("@PrimaryGeneratedColumn") || fullMatch.includes("@PrimaryColumn")) {
        const isUuid = fullMatch.includes("'uuid'") || rawTsType.toLowerCase().includes("string");
        parsedEntity.fields.push({
          name: propName,
          type: isUuid ? "uuid" : "int",
          primary: true,
          required: true,
          unique: true,
        });
        continue;
      }

      // Check Relations
      if (fullMatch.includes("@OneToMany")) {
        // One-to-many relations are derived automatically from owning many-to-one relations
        continue;
      }

      if (fullMatch.includes("@ManyToOne") || fullMatch.includes("@OneToOne") || fullMatch.includes("@ManyToMany")) {
        let kind: RelationKind = "many-to-one";
        if (fullMatch.includes("@OneToOne")) kind = "one-to-one";
        else if (fullMatch.includes("@ManyToMany")) kind = "many-to-many";

        // Find target class: @ManyToOne(() => Target, ...)
        const targetMatch = fullMatch.match(/=>\s*([A-Za-z0-9_]+)/);
        const targetClass = targetMatch ? targetMatch[1] : rawTsType.replace(/\[\]/g, "").trim();

        const nullable = /nullable:\s*true/.test(fullMatch) || fullMatch.includes("?:");
        const cascade = /cascade:\s*true/.test(fullMatch);

        parsedEntity.relations.push({
          name: propName,
          targetClassName: targetClass,
          kind,
          nullable,
          cascade,
        });
        continue;
      }

      // Ordinary Column
      if (fullMatch.includes("@Column")) {
        const colDecMatch = fullMatch.match(/@Column\s*\(([\s\S]*?)\)/);
        const decOpts = colDecMatch ? colDecMatch[1] : "";
        const inferred = inferTypeFromColumnDecorator(decOpts);

        const fieldType = inferred.type !== "string" ? inferred.type : inferTypeFromTsType(rawTsType);
        const isNullable = inferred.nullable || fullMatch.includes("?:");

        parsedEntity.fields.push({
          name: propName,
          type: fieldType,
          enumName: inferred.enumName,
          required: !isNullable,
          unique: inferred.unique,
          primary: false,
        });
      }
    }

    entities.push(parsedEntity);
  }

  // Build Project
  const projectName = options.projectName || "Imported API";
  const project = createProject(projectName);
  project.driver = options.driver || "postgres";
  if (options.defaultAuth === false) {
    project.auth.enabled = false;
  }
  project.enums = enums;

  const entityMap = new Map<string, EntityDef>(); // className.toLowerCase() -> EntityDef

  for (const pe of entities) {
    const isUser = pe.className.toLowerCase() === "user";
    const entity = isUser
      ? project.entities.find((e) => e.id === USER_ENTITY_ID)!
      : createEntity(pe.className);

    entity.options.timestamps = pe.hasTimestamps;
    entity.options.softDelete = pe.hasSoftDelete;

    for (const f of pe.fields) {
      if (isUser && AUTH_RESERVED_FIELD_NAMES.includes(f.name as any)) {
        continue;
      }
      if (!entity.fields.some((ex) => ex.name === f.name)) {
        const fieldDef = createField(f.name, f.type, {
          required: f.required,
          unique: f.unique,
          primary: f.primary,
          enumId: f.enumName ? enumMap.get(f.enumName) : undefined,
        });
        entity.fields.push(fieldDef);
      }
    }

    entityMap.set(pe.className.toLowerCase(), entity);
    if (!isUser && !project.entities.some((e) => e.id === entity.id)) {
      project.entities.push(entity);
    }
  }

  // Wire Relations
  for (const pe of entities) {
    const sourceEntity = entityMap.get(pe.className.toLowerCase());
    if (!sourceEntity) continue;

    for (const rel of pe.relations) {
      const targetEntity = entityMap.get(rel.targetClassName.toLowerCase());
      if (!targetEntity) continue;

      const relationDef = createRelation(rel.name, targetEntity.id, rel.kind, {
        nullable: rel.nullable,
        cascade: rel.cascade,
      });

      if (!sourceEntity.relations.some((r) => r.name === rel.name)) {
        sourceEntity.relations.push(relationDef);
      }

      if (targetEntity.id === USER_ENTITY_ID && (rel.name === "user" || rel.name === "owner" || rel.name === "author")) {
        sourceEntity.options.owner = true;
        sourceEntity.options.ownerRelation = rel.name;
      }
    }
  }

  // If an entity does not have an owner relation, default update operation to authenticated
  for (const entity of project.entities) {
    if (!entity.options.owner && entity.access.update.level === "owner") {
      entity.access.update = { level: "authenticated" };
    }
  }

  return project;
}
