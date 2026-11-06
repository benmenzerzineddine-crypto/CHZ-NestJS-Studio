import { describe, expect, it } from "vitest";
import { createCustomEndpoint, createEntity, createProject } from "@/core/model/defaults";
import { buildEntityRouteGroups, buildSystemRoutes } from "./route-builder";

describe("route-builder", () => {
  it("builds standard CRUD routes for entities", () => {
    const project = createProject("Test API");
    const user = createEntity("User");
    project.entities.push(user);

    const groups = buildEntityRouteGroups(project, "");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("User");
    expect(groups[0]?.path).toBe("/api/users");
    expect(groups[0]?.routes).toHaveLength(5);
    expect(groups[0]?.routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      "GET /api/users",
      "GET /api/users/:id",
      "POST /api/users",
      "PATCH /api/users/:id",
      "DELETE /api/users/:id",
    ]);
  });

  it("includes restore route when softDelete is enabled", () => {
    const project = createProject("Test API");
    const post = createEntity("Post");
    post.options.softDelete = true;
    project.entities.push(post);

    const groups = buildEntityRouteGroups(project, "");
    const restoreRoute = groups[0]?.routes.find((r) => r.path.endsWith("/restore"));
    expect(restoreRoute).toBeDefined();
    expect(restoreRoute?.method).toBe("POST");
    expect(restoreRoute?.note).toBe("Restore a soft-deleted row");
  });

  it("includes custom endpoints with throttle and cache overrides", () => {
    const project = createProject("Test API");
    const post = createEntity("Post");
    const customEp = createCustomEndpoint("publish", "POST", "/publish", { level: "authenticated" });
    customEp.throttle = { limit: 5, ttl: 30 };
    customEp.description = "Publish article";
    post.customEndpoints = [customEp];
    project.entities.push(post);

    const groups = buildEntityRouteGroups(project, "");
    const epRoute = groups[0]?.routes.find((r) => r.path === "/api/posts/publish");
    expect(epRoute).toBeDefined();
    expect(epRoute?.isCustom).toBe(true);
    expect(epRoute?.throttle).toBe("5/30s");
    expect(epRoute?.note).toBe("Publish article");
  });

  it("builds system routes including auth, password reset and admin user endpoints", () => {
    const project = createProject("Test API");
    project.auth.enabled = true;
    project.auth.adminUserEndpoints = true;
    project.auth.passwordReset = true;
    project.auth.emailVerification = true;

    const routes = buildSystemRoutes(project);
    const paths = routes.map((r) => `${r.method} ${r.path}`);

    expect(paths).toContain("GET /api/health");
    expect(paths).toContain("POST /api/auth/login");
    expect(paths).toContain("POST /api/auth/forgot-password");
    expect(paths).toContain("POST /api/auth/verify-email");
    expect(paths).toContain("GET /api/users");
    expect(paths).toContain("PATCH /api/users/:id/roles");
  });
});
