import { isSystemEntity } from "@/core/model/defaults";
import { toRestPath } from "@/core/model/naming";
import type { Project } from "@/core/model/schema";
import {
  OPERATION_METHODS,
  type AccessBadge,
  type RouteEntry,
  type RouteGroup,
} from "./types";

export function buildEntityRouteGroups(
  project: Project,
  query: string,
): RouteGroup[] {
  const prefix = `/${project.settings.apiPrefix}`;

  return project.entities
    .filter((entity) => !isSystemEntity(entity))
    .filter((entity) =>
      entity.name.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .map((entity) => {
      const basePath = `${prefix}/${toRestPath(entity.name)}`;
      const entityThrottleStr = entity.options.throttle
        ? `${entity.options.throttle.limit}/${entity.options.throttle.ttl}s`
        : undefined;
      const entityCacheStr = entity.options.cache
        ? `${entity.options.cache.maxAge}s (${entity.options.cache.scope})`
        : undefined;

      const routes: RouteEntry[] = OPERATION_METHODS.map((entry) => ({
        method: entry.method,
        path: `${basePath}${entry.suffix}`,
        access: entity.access[entry.operation].level,
        throttle: entityThrottleStr,
        cache: entry.method === "GET" ? entityCacheStr : undefined,
      }));

      if (entity.options.softDelete) {
        routes.push({
          method: "POST",
          path: `${basePath}/:id/restore`,
          access: entity.access.delete.level,
          note: "Restore a soft-deleted row",
          throttle: entityThrottleStr,
        });
      }

      for (const ep of entity.customEndpoints ?? []) {
        const subPath = ep.path.startsWith("/") ? ep.path : `/${ep.path}`;
        const customThrottle = ep.skipThrottle
          ? "exempt"
          : ep.throttle
            ? `${ep.throttle.limit}/${ep.throttle.ttl}s`
            : entityThrottleStr;
        const customCache =
          ep.method === "GET"
            ? ep.cache
              ? `${ep.cache.maxAge}s (${ep.cache.scope})`
              : entityCacheStr
            : undefined;

        routes.push({
          method: ep.method,
          path: `${basePath}${subPath === "/" ? "" : subPath}`,
          access: ep.access.level,
          note: ep.description || `Custom: ${ep.name}()`,
          isCustom: true,
          throttle: customThrottle,
          cache: customCache,
        });
      }

      const isMultitenant = Boolean(
        project.settings.multitenancy?.enabled && entity.options.multitenant,
      );

      return {
        name: entity.name,
        path: basePath,
        routes,
        multitenant: isMultitenant,
        throttle: entityThrottleStr,
        cache: entityCacheStr,
      };
    });
}

export function buildSystemRoutes(project: Project): RouteEntry[] {
  const prefix = `/${project.settings.apiPrefix}`;
  const routes: RouteEntry[] = [
    { method: "GET", path: `${prefix}/health`, access: "public" },
  ];

  if (!project.auth.enabled) return routes;

  if (project.auth.registerEnabled) {
    routes.push({
      method: "POST",
      path: `${prefix}/auth/register`,
      access: "public",
    });
  }
  routes.push(
    { method: "POST", path: `${prefix}/auth/login`, access: "public" },
    { method: "POST", path: `${prefix}/auth/logout`, access: "authenticated" },
    { method: "GET", path: `${prefix}/auth/me`, access: "authenticated" },
  );
  if (project.auth.refreshTokens) {
    routes.push({
      method: "POST",
      path: `${prefix}/auth/refresh`,
      access: "public",
    });
  }

  if (project.auth.passwordReset) {
    routes.push(
      {
        method: "POST",
        path: `${prefix}/auth/forgot-password`,
        access: "public",
        note: "Request password reset email",
      },
      {
        method: "POST",
        path: `${prefix}/auth/reset-password`,
        access: "public",
        note: "Reset password with single-use token",
      },
    );
  }

  if (project.auth.emailVerification) {
    routes.push(
      {
        method: "POST",
        path: `${prefix}/auth/verify-email`,
        access: "public",
        note: "Confirm email address with token",
      },
      {
        method: "POST",
        path: `${prefix}/auth/resend-verification`,
        access: "authenticated",
        note: "Resend email verification token",
      },
    );
  }

  if (project.auth.adminUserEndpoints) {
    routes.push(
      { method: "GET", path: `${prefix}/users`, access: "admin" },
      { method: "PATCH", path: `${prefix}/users/:id/roles`, access: "admin" },
      { method: "DELETE", path: `${prefix}/users/:id`, access: "admin" },
    );
  }

  if (project.settings.uploads?.enabled) {
    const uploadAccess: AccessBadge = project.auth.enabled ? "authenticated" : "public";
    routes.push(
      {
        method: "POST",
        path: `${prefix}/attachments/upload`,
        access: uploadAccess,
        note: "Upload multipart file",
      },
      {
        method: "GET",
        path: `${prefix}/attachments/:id`,
        access: uploadAccess,
        note: "Fetch attachment metadata",
      },
      {
        method: "GET",
        path: `${prefix}/attachments/:id/download`,
        access: uploadAccess,
        note: "Stream raw file contents",
      },
      {
        method: "DELETE",
        path: `${prefix}/attachments/:id`,
        access: uploadAccess,
        note: "Delete attachment and stored file",
      },
    );
  }

  return routes;
}
