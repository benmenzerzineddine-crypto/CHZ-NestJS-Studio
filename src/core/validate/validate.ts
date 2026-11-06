import {
  ADMIN_ROLE,
  USER_ENTITY_ID,
  isSystemEntity,
} from "../model/defaults";
import { toRestPath } from "../model/naming";
import type {
  EntityDef,
  Project,
  RelationDef,
} from "../model/schema";
import { checkEntity } from "./check-entity";
import { checkQueues } from "./check-queues";
import { checkWebSockets } from "./check-websockets";
import {
  API_PREFIX,
  DURATION,
  ENUM_VALUE,
  PACKAGE_NAME,
  issue,
  type IssueSeverity,
  type ValidationIssue,
} from "./types";

export type { IssueSeverity, ValidationIssue };

function projectsHasRole(project: Project, key: string): boolean {
  return project.auth.roles.some((role) => role.key === key);
}

export function validateProject(project: Project): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const roles = new Set(project.auth.roles.map((role) => role.key));
  const entityIds = new Set(project.entities.map((entity) => entity.id));
  const userEntity = project.entities.find((entity) => entity.id === USER_ENTITY_ID);

  if (!userEntity) {
    issues.push(
      issue({
        code: "project.user.missing",
        message: "The built-in User entity is missing from the project.",
      }),
    );
  }

  if (!project.name.trim()) {
    issues.push(issue({ code: "project.name.empty", message: "Project name cannot be empty." }));
  }

  if (!PACKAGE_NAME.test(project.packageName)) {
    issues.push(
      issue({
        code: "project.package.invalid",
        message: "Package name must use lowercase letters, digits and dashes.",
      }),
    );
  }

  if (!API_PREFIX.test(project.settings.apiPrefix)) {
    issues.push(
      issue({
        code: "project.prefix.invalid",
        message: "API prefix must start with a letter and use lowercase letters, digits or dashes.",
      }),
    );
  }

  const entityNames = new Set<string>();
  for (const entity of project.entities) {
    const key = entity.name.toLowerCase();
    if (entityNames.has(key)) {
      issues.push(
        issue({
          code: "entity.name.duplicate",
          entityId: entity.id,
          message: `Duplicate entity name "${entity.name}".`,
        }),
      );
    }
    entityNames.add(key);
  }

  const paths = new Map<string, string>();
  for (const entity of project.entities) {
    const path = toRestPath(entity.name);
    if (project.settings.uploads?.enabled && path === "attachments") {
      issues.push(
        issue({
          code: "entity.path.reserved",
          entityId: entity.id,
          message: `"${entity.name}" collides with the built-in /attachments route.`,
        }),
      );
    }
    const existing = paths.get(path);
    if (existing) {
      issues.push(
        issue({
          code: "entity.path.duplicate",
          entityId: entity.id,
          message: `${entity.name} and ${existing} share the REST path /${path}.`,
        }),
      );
    } else {
      paths.set(path, entity.name);
    }
  }

  if (project.settings.uploads) {
    if (
      project.settings.uploads.maxFileSizeMb <= 0 ||
      project.settings.uploads.maxFileSizeMb > 500
    ) {
      issues.push(
        issue({
          code: "project.uploads.size",
          message: "Maximum upload file size must be between 1 MB and 500 MB.",
        }),
      );
    }
  }

  if (project.settings.multitenancy) {
    if (!/^[a-z0-9-]+$/.test(project.settings.multitenancy.header)) {
      issues.push(
        issue({
          code: "project.multitenancy.header",
          message:
            "Multi-tenancy header must be a valid HTTP header name (lowercase alphanumeric and dashes).",
        }),
      );
    }
  }

  for (const entity of project.entities) {
    checkEntity(project, entity, issues, roles, entityIds, userEntity?.id);
  }

  for (const enumDef of project.enums) {
    if (enumDef.values.length === 0) {
      issues.push(
        issue({
          code: "enum.values.empty",
          enumId: enumDef.id,
          message: `Enum ${enumDef.name} has no values.`,
        }),
      );
    }

    const seen = new Set<string>();
    for (const value of enumDef.values) {
      if (!ENUM_VALUE.test(value)) {
        issues.push(
          issue({
            code: "enum.value.invalid",
            enumId: enumDef.id,
            message: `"${value}" is not a valid enum value.`,
          }),
        );
      }
      if (seen.has(value)) {
        issues.push(
          issue({
            code: "enum.value.duplicate",
            enumId: enumDef.id,
            message: `Duplicate enum value "${value}".`,
          }),
        );
      }
      seen.add(value);
    }

    const used = project.entities.some((entity) =>
      entity.fields.some((field) => field.enumId === enumDef.id),
    );
    if (!used) {
      issues.push(
        issue({
          severity: "warning",
          code: "enum.unused",
          enumId: enumDef.id,
          message: `Enum ${enumDef.name} is not used by any field.`,
        }),
      );
    }
  }

  const roleKeys = new Set<string>();
  for (const role of project.auth.roles) {
    if (roleKeys.has(role.key)) {
      issues.push(
        issue({
          code: "auth.role.duplicate",
          message: `Duplicate role "${role.key}".`,
        }),
      );
    }
    roleKeys.add(role.key);
  }

  if (project.auth.roles.length === 0) {
    issues.push(issue({ code: "auth.roles.empty", message: "At least one role is required." }));
  }

  const ownershipUsed = project.entities.some(
    (entity) => !isSystemEntity(entity) && entity.options.owner,
  );

  if (
    project.auth.enabled &&
    !projectsHasRole(project, ADMIN_ROLE) &&
    (project.auth.adminUserEndpoints || ownershipUsed)
  ) {
    issues.push(
      issue({
        code: "auth.admin.missing",
        message:
          "The admin role is required for admin user endpoints and ownership bypass, but it is not defined.",
      }),
    );
  }

  if (!DURATION.test(project.auth.accessTokenTtl)) {
    issues.push(
      issue({ code: "auth.ttl.access", message: "Access token TTL must look like 15m or 1h." }),
    );
  }

  if (!DURATION.test(project.auth.refreshTokenTtl)) {
    issues.push(
      issue({ code: "auth.ttl.refresh", message: "Refresh token TTL must look like 7d or 24h." }),
    );
  }

  if (project.auth.passwordMinLength < 6 || project.auth.passwordMinLength > 72) {
    issues.push(
      issue({
        code: "auth.password.length",
        message: "Password minimum length must be between 6 and 72.",
      }),
    );
  }

  if (!project.auth.enabled) {
    issues.push(
      issue({
        severity: "warning",
        code: "auth.disabled",
        message: "Authentication is disabled; generated routes will have no guards.",
      }),
    );

    if (project.auth.adminUserEndpoints || project.auth.seedAdmin) {
      issues.push(
        issue({
          severity: "warning",
          code: "auth.disabled.options",
          message: "Admin users and seed admin are ignored while authentication is disabled.",
        }),
      );
    }
  }

  checkQueues(project, issues);
  checkWebSockets(project, issues);

  return issues;
}

export function countIssues(issues: ValidationIssue[]): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.severity === "error") errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}

export function relationTarget(
  project: Project,
  relation: RelationDef,
): EntityDef | undefined {
  return project.entities.find((entity) => entity.id === relation.targetEntityId);
}
