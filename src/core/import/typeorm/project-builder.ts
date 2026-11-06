import {
  createEntity,
  createField,
  createRelation,
  createProject,
  USER_ENTITY_ID,
  AUTH_RESERVED_FIELD_NAMES,
} from "../../model/defaults";
import type { EntityDef, EnumDef, Project } from "../../model/schema";
import type { ParsedTypeOrmEntity, TypeOrmImportOptions } from "./types";

export function buildTypeOrmProject(
  entities: ParsedTypeOrmEntity[],
  enums: EnumDef[],
  options: TypeOrmImportOptions = {},
): Project {
  const enumMap = new Map<string, string>();
  for (const enm of enums) {
    enumMap.set(enm.name, enm.id);
  }

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
