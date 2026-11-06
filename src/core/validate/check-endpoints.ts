import type { EntityDef, Project } from "../model/schema";
import { CRUD_METHOD_NAMES, issue, type ValidationIssue } from "./types";

export function normalizeRoutePath(raw: string): string {
  const trimmed = raw.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed === "" ? "" : trimmed;
}

export function checkCustomEndpoints(
  project: Project,
  entity: EntityDef,
  issues: ValidationIssue[],
  roles: Set<string>,
): void {
  const endpointNames = new Set<string>();
  const endpointRoutes = new Set<string>();

  for (const ep of entity.customEndpoints ?? []) {
    if (CRUD_METHOD_NAMES.has(ep.name)) {
      issues.push(
        issue({
          code: "endpoint.name.reserved",
          entityId: entity.id,
          customEndpointId: ep.id,
          message: `Custom endpoint "${ep.name}" on ${entity.name} collides with built-in CRUD method.`,
        }),
      );
    }

    const nameKey = ep.name.toLowerCase();
    if (endpointNames.has(nameKey)) {
      issues.push(
        issue({
          code: "endpoint.name.duplicate",
          entityId: entity.id,
          customEndpointId: ep.id,
          message: `Duplicate custom endpoint name "${ep.name}" on ${entity.name}.`,
        }),
      );
    }
    endpointNames.add(nameKey);

    const normPath = normalizeRoutePath(ep.path);
    const routeKey = `${ep.method}:${normPath}`;
    if (endpointRoutes.has(routeKey)) {
      issues.push(
        issue({
          code: "endpoint.route.duplicate",
          entityId: entity.id,
          customEndpointId: ep.id,
          message: `Duplicate route "${ep.method} ${ep.path}" on ${entity.name}.`,
        }),
      );
    }
    endpointRoutes.add(routeKey);

    const isCrudCollision =
      (ep.method === "GET" && (normPath === "" || normPath === ":id")) ||
      (ep.method === "POST" && normPath === "") ||
      (ep.method === "PATCH" && normPath === ":id") ||
      (ep.method === "DELETE" && normPath === ":id") ||
      (entity.options.softDelete && ep.method === "POST" && normPath === ":id/restore");

    if (isCrudCollision) {
      issues.push(
        issue({
          code: "endpoint.route.reserved",
          entityId: entity.id,
          customEndpointId: ep.id,
          message: `Route "${ep.method} ${ep.path}" collides with a standard CRUD route on ${entity.name}.`,
        }),
      );
    }

    if (project.auth.enabled) {
      if (ep.access.level === "roles") {
        if (!ep.access.roles || ep.access.roles.length === 0) {
          issues.push(
            issue({
              code: "endpoint.access.roles.missing",
              entityId: entity.id,
              customEndpointId: ep.id,
              message: `Custom endpoint "${ep.name}" requires at least one role.`,
            }),
          );
        } else {
          for (const role of ep.access.roles) {
            if (!roles.has(role)) {
              issues.push(
                issue({
                  code: "endpoint.access.role.unknown",
                  entityId: entity.id,
                  customEndpointId: ep.id,
                  message: `Custom endpoint "${ep.name}" references unknown role "${role}".`,
                }),
              );
            }
          }
        }
      }

      if (ep.access.level === "owner" && !entity.options.owner) {
        issues.push(
          issue({
            code: "endpoint.access.owner.missing",
            entityId: entity.id,
            customEndpointId: ep.id,
            message: `Custom endpoint "${ep.name}" uses ownership but ${entity.name} has no owner relation.`,
          }),
        );
      }
    }

    if (ep.cache && ep.method !== "GET") {
      issues.push(
        issue({
          code: "endpoint.cache.method.invalid",
          entityId: entity.id,
          customEndpointId: ep.id,
          message: `Custom endpoint "${ep.name}" has a cache hint, but caching is only supported on GET endpoints.`,
        }),
      );
    }

    if (
      ep.cache &&
      ep.cache.sharedMaxAge != null &&
      (ep.cache.scope === "private" || ep.cache.scope === "no-store")
    ) {
      issues.push(
        issue({
          severity: "warning",
          code: "endpoint.cache.sharedMaxAge.invalid",
          entityId: entity.id,
          customEndpointId: ep.id,
          message: `Custom endpoint "${ep.name}" cache hint has sharedMaxAge set, which is ignored for ${ep.cache.scope} responses.`,
        }),
      );
    }

    if (ep.skipThrottle && ep.throttle) {
      issues.push(
        issue({
          code: "endpoint.throttle.conflict",
          entityId: entity.id,
          customEndpointId: ep.id,
          message: `Custom endpoint "${ep.name}" cannot specify both skipThrottle and a custom throttle override.`,
        }),
      );
    }
  }
}
