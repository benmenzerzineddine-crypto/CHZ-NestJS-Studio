import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE,
  AUTH_RESERVED_FIELD_NAMES,
  DEFAULT_ROLE,
  USER_ENTITY_ID,
  buildUserEntity,
  createCustomEndpoint,
  createEntity,
  createField,
  createProject,
  createRelation,
  defaultAccess,
  defaultAuth,
  defaultThrottling,
  defaultGraphQL,
  isSystemEntity,
  toPackageName,
} from "./defaults";
import { projectSchema } from "./schema";

describe("createProject", () => {
  it("produces a valid project with the built-in User entity", () => {
    const project = createProject("Blog API");
    expect(projectSchema.safeParse(project).success).toBe(true);
    expect(project.entities).toHaveLength(1);
    expect(project.entities[0].id).toBe(USER_ENTITY_ID);
    expect(project.entities[0].name).toBe("User");
  });

  it("defaults to postgres and auth enabled", () => {
    const project = createProject("Blog API");
    expect(project.driver).toBe("postgres");
    expect(project.auth.enabled).toBe(true);
    expect(project.settings).toEqual({
      packageManager: "npm",
      apiPrefix: "api",
      swagger: true,
      docker: true,
      tests: true,
      uploads: {
        enabled: false,
        driver: "local",
        maxFileSizeMb: 10,
      },
      multitenancy: {
        enabled: false,
        header: "x-tenant-id",
      },
      throttling: {
        enabled: true,
        ttl: 60,
        limit: 100,
      },
      graphql: {
        enabled: false,
        playground: true,
        path: "/graphql",
      },
      queues: {
        enabled: false,
        redisHost: "localhost",
        redisPort: 6379,
        queues: [],
      },
      websockets: {
        enabled: false,
        adapter: "socket.io",
        path: "/events",
        corsOrigin: "*",
        auth: true,
        broadcastCrud: true,
      },
      seeding: {
        enabled: true,
        count: 3,
        realistic: true,
      },
    });
  });

  it("derives a safe package name", () => {
    expect(createProject("Blog API").packageName).toBe("blog-api");
    expect(createProject("  ").packageName).toBe("my-api");
  });

  it("supports auth-disabled projects", () => {
    const project = createProject("Blog API", "sqlite", false);
    expect(project.auth.enabled).toBe(false);
    expect(project.driver).toBe("sqlite");
  });
});

describe("defaults", () => {
  it("matches the documented access matrix", () => {
    expect(defaultAccess()).toEqual({
      list: { level: "authenticated" },
      read: { level: "authenticated" },
      create: { level: "authenticated" },
      update: { level: "owner" },
      delete: { level: "roles", roles: [ADMIN_ROLE] },
    });
  });

  it("seeds the admin and user roles with default oauth and 2fa settings", () => {
    const auth = defaultAuth();
    expect(auth.roles.map((role) => role.key)).toEqual([ADMIN_ROLE, DEFAULT_ROLE]);
    expect(auth.passwordMinLength).toBe(10);
    expect(auth.oauth).toEqual({ google: false, github: false });
    expect(auth.twoFactor).toBe(false);
  });

  it("reserves authentication fields including oauth and 2fa columns", () => {
    expect(AUTH_RESERVED_FIELD_NAMES).toContain("googleId");
    expect(AUTH_RESERVED_FIELD_NAMES).toContain("githubId");
    expect(AUTH_RESERVED_FIELD_NAMES).toContain("avatarUrl");
    expect(AUTH_RESERVED_FIELD_NAMES).toContain("twoFactorSecret");
    expect(AUTH_RESERVED_FIELD_NAMES).toContain("twoFactorEnabled");
    expect(AUTH_RESERVED_FIELD_NAMES).toContain("twoFactorRecoveryCodes");
  });

  it("creates entities with timestamps and pagination on", () => {
    const entity = createEntity("Post");
    expect(entity.options).toEqual({
      timestamps: true,
      softDelete: false,
      pagination: true,
      searchFields: [],
      sortFields: [],
      owner: false,
      multitenant: false,
    });
    expect(entity.access).toEqual(defaultAccess());
  });

  it("creates fields with safe defaults", () => {
    const field = createField("title", "string");
    expect(field).toMatchObject({
      name: "title",
      type: "string",
      required: true,
      unique: false,
      indexed: false,
      primary: false,
    });
  });

  it("creates many-to-one relations by default", () => {
    const relation = createRelation("author", "ent_author");
    expect(relation).toMatchObject({
      name: "author",
      targetEntityId: "ent_author",
      kind: "many-to-one",
      nullable: false,
      cascade: false,
    });
  });

  it("recognizes the built-in User entity", () => {
    expect(isSystemEntity(buildUserEntity())).toBe(true);
    expect(isSystemEntity(createEntity("Post"))).toBe(false);
  });

  it("slugifies package names", () => {
    expect(toPackageName("Chéz Nest — API")).toBe("chez-nest-api");
    expect(toPackageName("!!!")).toBe("my-api");
  });

  it("creates custom endpoints with safe defaults", () => {
    const ep = createCustomEndpoint("publish", "POST", "/publish");
    expect(ep).toMatchObject({
      name: "publish",
      method: "POST",
      path: "/publish",
      access: { level: "authenticated" },
    });
    expect(ep.id).toMatch(/^ep_[a-z0-9]{12}$/);
  });

  it("provides safe default throttling configuration", () => {
    expect(defaultThrottling()).toEqual({
      enabled: true,
      ttl: 60,
      limit: 100,
    });
  });

  it("provides safe default GraphQL configuration", () => {
    expect(defaultGraphQL()).toEqual({
      enabled: false,
      playground: true,
      path: "/graphql",
    });
  });
});
