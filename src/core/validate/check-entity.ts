import {
  RESERVED_ENTITY_NAMES,
  isSystemEntity,
} from "../model/defaults";
import {
  OPERATIONS,
  type EntityDef,
  type Project,
} from "../model/schema";
import { checkCustomEndpoints } from "./check-endpoints";
import { checkFields } from "./check-fields";
import { checkRelations } from "./check-relations";
import { ENTITY_NAME, issue, type ValidationIssue } from "./types";

export function isSearchable(entity: EntityDef, name: string): boolean {
  const field = entity.fields.find((candidate) => candidate.name === name);
  return field?.type === "string" || field?.type === "text";
}

export function isSortable(entity: EntityDef, name: string): boolean {
  const field = entity.fields.find((candidate) => candidate.name === name);
  return field !== undefined && field.type !== "json";
}

export function checkEntity(
  project: Project,
  entity: EntityDef,
  issues: ValidationIssue[],
  roles: Set<string>,
  entityIds: Set<string>,
  userEntityId: string | undefined,
): void {
  const system = isSystemEntity(entity);

  if (!ENTITY_NAME.test(entity.name)) {
    issues.push(
      issue({
        code: "entity.name.invalid",
        entityId: entity.id,
        message: `"${entity.name}" is not a valid entity name (use PascalCase).`,
      }),
    );
  }

  if (!system && (RESERVED_ENTITY_NAMES as readonly string[]).includes(entity.name)) {
    issues.push(
      issue({
        code: "entity.name.reserved",
        entityId: entity.id,
        message: `"${entity.name}" is reserved for generated code.`,
      }),
    );
  }

  if (system && entity.name !== "User") {
    issues.push(
      issue({
        code: "entity.user.renamed",
        entityId: entity.id,
        message: "The built-in account entity must keep the name User.",
      }),
    );
  }

  if (entity.options.multitenant) {
    if (!project.settings.multitenancy?.enabled) {
      issues.push(
        issue({
          severity: "warning",
          code: "entity.multitenant.disabled",
          entityId: entity.id,
          message: `Entity "${entity.name}" has multi-tenancy enabled, but project-level multi-tenancy is disabled.`,
        }),
      );
    }
    if (system) {
      issues.push(
        issue({
          code: "entity.multitenant.system",
          entityId: entity.id,
          message: `Built-in entity "${entity.name}" cannot be multi-tenant.`,
        }),
      );
    }
  }

  if (
    entity.options.cache &&
    entity.options.cache.sharedMaxAge != null &&
    (entity.options.cache.scope === "private" || entity.options.cache.scope === "no-store")
  ) {
    issues.push(
      issue({
        severity: "warning",
        code: "entity.cache.sharedMaxAge.invalid",
        entityId: entity.id,
        message: `Entity "${entity.name}" cache hint has sharedMaxAge set, which is ignored for ${entity.options.cache.scope} responses.`,
      }),
    );
  }

  const fieldNames = new Set<string>();
  checkFields(project, entity, issues, fieldNames);
  checkRelations(entity, issues, fieldNames, entityIds, system);

  for (const name of entity.options.searchFields) {
    if (!isSearchable(entity, name)) {
      issues.push(
        issue({
          code: "entity.search.invalid",
          entityId: entity.id,
          message: `Search field "${name}" must exist and be a string or text field.`,
        }),
      );
    }
  }

  for (const name of entity.options.sortFields) {
    if (!isSortable(entity, name)) {
      issues.push(
        issue({
          code: "entity.sort.invalid",
          entityId: entity.id,
          message: `Sort field "${name}" must exist and be a scalar field.`,
        }),
      );
    }
  }

  if (new Set(entity.options.searchFields).size !== entity.options.searchFields.length) {
    issues.push(
      issue({
        severity: "warning",
        code: "entity.search.duplicate",
        entityId: entity.id,
        message: "Search fields contain duplicates.",
      }),
    );
  }

  if (new Set(entity.options.sortFields).size !== entity.options.sortFields.length) {
    issues.push(
      issue({
        severity: "warning",
        code: "entity.sort.duplicate",
        entityId: entity.id,
        message: "Sort fields contain duplicates.",
      }),
    );
  }

  if (entity.options.owner) {
    if (!entity.options.ownerRelation) {
      issues.push(
        issue({
          code: "entity.owner.relation.missing",
          entityId: entity.id,
          message: `${entity.name} uses ownership but has no owner relation.`,
        }),
      );
    } else {
      const ownerRelation = entity.relations.find(
        (relation) => relation.name === entity.options.ownerRelation,
      );

      if (!ownerRelation) {
        issues.push(
          issue({
            code: "entity.owner.relation.missing",
            entityId: entity.id,
            message: `Owner relation "${entity.options.ownerRelation}" does not exist on ${entity.name}.`,
          }),
        );
      } else if (!userEntityId || ownerRelation.targetEntityId !== userEntityId) {
        issues.push(
          issue({
            code: "entity.owner.relation.target",
            entityId: entity.id,
            relationId: ownerRelation.id,
            message: "The owner relation must target the built-in User entity.",
          }),
        );
      } else if (ownerRelation.kind !== "many-to-one") {
        issues.push(
          issue({
            code: "entity.owner.relation.kind",
            entityId: entity.id,
            relationId: ownerRelation.id,
            message: "The owner relation must be many-to-one.",
          }),
        );
      }
    }
  } else if (entity.options.ownerRelation) {
    issues.push(
      issue({
        severity: "warning",
        code: "entity.owner.disabled",
        entityId: entity.id,
        message: "An owner relation is configured but ownership is disabled.",
      }),
    );
  }

  if (!system && project.auth.enabled) {
    for (const operation of OPERATIONS) {
      const rule = entity.access[operation];

      if (rule.level === "roles") {
        if (!rule.roles || rule.roles.length === 0) {
          issues.push(
            issue({
              code: "access.roles.missing",
              entityId: entity.id,
              operation,
              message: `${entity.name}.${operation} requires at least one role.`,
            }),
          );
        } else {
          for (const role of rule.roles) {
            if (!roles.has(role)) {
              issues.push(
                issue({
                  code: "access.role.unknown",
                  entityId: entity.id,
                  operation,
                  message: `${entity.name}.${operation} references unknown role "${role}".`,
                }),
              );
            }
          }
        }
      }

      if (rule.level === "owner" && !entity.options.owner) {
        issues.push(
          issue({
            code: "access.owner.missing",
            entityId: entity.id,
            operation,
            message: `${entity.name}.${operation} uses ownership but the entity has no owner relation.`,
          }),
        );
      }

      if (rule.level === "public" && operation === "create" && entity.options.owner) {
        issues.push(
          issue({
            code: "access.owner.public-create",
            entityId: entity.id,
            operation,
            message: `${entity.name} uses ownership but allows public creates; no authenticated user is available to own the row.`,
          }),
        );
      }

      if (
        rule.level === "public" &&
        operation !== "list" &&
        operation !== "read"
      ) {
        issues.push(
          issue({
            severity: "warning",
            code: "access.public.write",
            entityId: entity.id,
            operation,
            message: `${entity.name}.${operation} is public and allows unauthenticated writes.`,
          }),
        );
      }
    }
  }

  checkCustomEndpoints(project, entity, issues, roles);
}
