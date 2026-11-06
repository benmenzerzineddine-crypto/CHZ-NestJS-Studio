import {
  createEntity,
  createField,
  createRelation,
  createEnum,
  createProject,
  createCustomEndpoint,
  USER_ENTITY_ID,
  AUTH_RESERVED_FIELD_NAMES,
} from "../model/defaults";
import type {
  Driver,
  EntityDef,
  EnumDef,
  FieldDef,
  FieldType,
  HttpMethod,
  Project,
} from "../model/schema";
import { toCamelCase, toEntityName, toEnumName, toPascalCase } from "./naming";

export interface OpenApiImportOptions {
  projectName?: string;
  driver?: Driver;
  defaultAuth?: boolean;
}

interface OpenApiProperty {
  type?: string;
  format?: string;
  enum?: string[];
  $ref?: string;
  readOnly?: boolean;
}

interface OpenApiSchema {
  type?: string;
  properties?: Record<string, OpenApiProperty>;
  required?: string[];
  enum?: string[];
}

function mapOpenApiType(prop: OpenApiProperty): FieldType {
  if (prop.enum && prop.enum.length > 0) return "enum";
  if (prop.type === "integer") return "int";
  if (prop.type === "number") {
    return prop.format === "float" || prop.format === "double" ? "float" : "decimal";
  }
  if (prop.type === "boolean") return "boolean";
  if (prop.type === "string") {
    if (prop.format === "uuid") return "uuid";
    if (prop.format === "date") return "date";
    if (prop.format === "date-time") return "datetime";
    if (prop.format === "binary") return "string";
    return "string";
  }
  if (prop.type === "array" || prop.type === "object") return "json";
  return "string";
}

export function parseOpenApi(spec: string | Record<string, any>, options: OpenApiImportOptions = {}): Project {
  let doc: Record<string, any>;
  if (typeof spec === "string") {
    try {
      doc = JSON.parse(spec);
    } catch {
      throw new Error("Invalid OpenAPI specification: must be valid JSON");
    }
  } else {
    doc = spec;
  }

  const schemas: Record<string, OpenApiSchema> =
    doc.components?.schemas || doc.definitions || {};

  const projectName = options.projectName || doc.info?.title || "Imported API";
  const project = createProject(projectName);
  project.driver = options.driver || "postgres";
  if (options.defaultAuth === false) {
    project.auth.enabled = false;
  }

  const enums: EnumDef[] = [];
  const enumMap = new Map<string, string>(); // enumName -> enumId

  // Phase 1: Scan schemas and register standalone enums
  for (const [schemaName, schema] of Object.entries(schemas)) {
    if (schema.enum && schema.enum.length > 0) {
      const enm = createEnum(toPascalCase(schemaName), schema.enum);
      enums.push(enm);
      enumMap.set(enm.name, enm.id);
    }
  }

  // Phase 2: Create entities from object schemas
  const entityMap = new Map<string, EntityDef>(); // schemaName.toLowerCase() -> EntityDef

  for (const [schemaName, schema] of Object.entries(schemas)) {
    if (schema.enum) continue; // Skip pure enum schemas
    if (schema.type !== "object" && !schema.properties) continue;

    const entityName = toPascalCase(schemaName);
    const isUser = entityName.toLowerCase() === "user";

    const entity = isUser
      ? project.entities.find((e) => e.id === USER_ENTITY_ID)!
      : createEntity(entityName);

    const properties = schema.properties || {};
    const requiredProps = new Set(schema.required || []);

    let hasCreatedAt = false;
    let hasUpdatedAt = false;
    let hasDeletedAt = false;

    for (const [propName, prop] of Object.entries(properties)) {
      const lower = propName.toLowerCase();
      if (lower === "createdat" || lower === "created_at") {
        hasCreatedAt = true;
        continue;
      }
      if (lower === "updatedat" || lower === "updated_at") {
        hasUpdatedAt = true;
        continue;
      }
      if (lower === "deletedat" || lower === "deleted_at") {
        hasDeletedAt = true;
        continue;
      }

      if (isUser && AUTH_RESERVED_FIELD_NAMES.includes(propName as any)) {
        continue;
      }

      // Check if property is a $ref relation
      if (prop.$ref) {
        continue;
      }

      // Inline enum
      let enumId: string | undefined;
      let fieldType = mapOpenApiType(prop);

      if (prop.enum && prop.enum.length > 0) {
        const generatedEnumName = toEnumName(`${entityName}_${propName}`);
        if (!enumMap.has(generatedEnumName)) {
          const newEnm = createEnum(generatedEnumName, prop.enum);
          enums.push(newEnm);
          enumMap.set(generatedEnumName, newEnm.id);
        }
        enumId = enumMap.get(generatedEnumName);
        fieldType = "enum";
      }

      const isPk = propName === "id";
      const fieldDef: FieldDef = createField(toCamelCase(propName), fieldType, {
        required: isPk || requiredProps.has(propName),
        unique: isPk,
        primary: isPk,
        enumId,
      });

      if (!entity.fields.some((f) => f.name === fieldDef.name)) {
        entity.fields.push(fieldDef);
      }
    }

    entity.options.timestamps = hasCreatedAt && hasUpdatedAt;
    entity.options.softDelete = hasDeletedAt;

    entityMap.set(schemaName.toLowerCase(), entity);
    if (!isUser && !project.entities.some((e) => e.id === entity.id)) {
      project.entities.push(entity);
    }
  }

  // Phase 3: Relations from $ref properties
  for (const [schemaName, schema] of Object.entries(schemas)) {
    const sourceEntity = entityMap.get(schemaName.toLowerCase());
    if (!sourceEntity) continue;

    const properties = schema.properties || {};
    for (const [propName, prop] of Object.entries(properties)) {
      if (prop.$ref) {
        const refParts = prop.$ref.split("/");
        const targetSchemaName = refParts[refParts.length - 1];
        const targetEntity = entityMap.get(targetSchemaName?.toLowerCase());
        if (targetEntity) {
          const relation = createRelation(toCamelCase(propName), targetEntity.id, "many-to-one");
          if (!sourceEntity.relations.some((r) => r.name === relation.name)) {
            sourceEntity.relations.push(relation);
          }
          if (targetEntity.id === USER_ENTITY_ID && (propName === "user" || propName === "owner" || propName === "author")) {
            sourceEntity.options.owner = true;
            sourceEntity.options.ownerRelation = toCamelCase(propName);
          }
        }
      }
    }
  }

  // Phase 4: Paths to Custom Endpoints
  const paths: Record<string, Record<string, any>> = doc.paths || {};

  for (const [pathStr, pathItem] of Object.entries(paths)) {
    for (const [rawMethod, operation] of Object.entries(pathItem)) {
      const method = rawMethod.toUpperCase() as HttpMethod;
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) continue;

      // Extract target entity from path tag or segment
      const segments = pathStr.split("/").filter(Boolean);
      if (segments.length === 0) continue;

      const firstSegment = segments[0].replace(/^{|}$/g, "");
      const matchedEntity = project.entities.find(
        (e) =>
          e.name.toLowerCase() === toEntityName(firstSegment).toLowerCase() ||
          (operation.tags && operation.tags.includes(e.name)),
      );

      // Check if standard CRUD operation
      const isStandardCrud =
        segments.length <= 2 &&
        (method === "GET" || method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") &&
        (segments.length === 1 || segments[1] === "{id}" || segments[1] === ":id");

      if (matchedEntity && !isStandardCrud) {
        // Build subpath relative to entity
        const subPath = "/" + segments.slice(1).join("/").replace(/\{([^}]+)\}/g, ":$1");
        const endpointName = operation.operationId ? toCamelCase(operation.operationId) : `${method.toLowerCase()}${toPascalCase(segments[segments.length - 1])}`;

        const endpoint = createCustomEndpoint(
          endpointName,
          method,
          subPath || `/${endpointName}`,
          { level: "authenticated" },
          { description: operation.summary || operation.description },
        );

        if (!matchedEntity.customEndpoints.some((ep) => ep.path === endpoint.path && ep.method === endpoint.method)) {
          matchedEntity.customEndpoints.push(endpoint);
        }
      }
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
