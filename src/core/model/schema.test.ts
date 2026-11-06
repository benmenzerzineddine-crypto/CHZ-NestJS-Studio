import { describe, expect, it } from "vitest";
import { createCustomEndpoint, createField, createProject } from "./defaults";
import {
  accessRuleSchema,
  cacheHintSchema,
  customEndpointSchema,
  fieldDefinitionSchema,
  migrateProject,
  multitenancyConfigSchema,
  projectSchema,
  throttleOverrideSchema,
  throttlingConfigSchema,
  uploadConfigSchema,
  graphqlConfigSchema,
} from "./schema";

describe("projectSchema", () => {
  it("accepts a project built from the factories", () => {
    expect(projectSchema.safeParse(createProject("Blog API")).success).toBe(true);
  });

  it("rejects unknown fields", () => {
    const project = { ...createProject("Blog API"), surprise: true };
    expect(projectSchema.safeParse(project).success).toBe(false);
  });

  it("requires the full access matrix", () => {
    const project = createProject("Blog API");
    const entity = project.entities[0];
    const access = { ...entity.access };
    delete (access as { delete?: unknown }).delete;

    const next = { ...project, entities: [{ ...entity, access }] };
    expect(projectSchema.safeParse(next).success).toBe(false);
  });

  it("rejects duplicate entity names case-insensitively", () => {
    const project = createProject("Blog API");
    const user = project.entities[0];
    const duplicate = { ...user, id: "ent_duplicate" };

    const next = { ...project, entities: [user, duplicate] };
    expect(projectSchema.safeParse(next).success).toBe(false);
  });
});

describe("accessRuleSchema", () => {
  it("requires at least one role for the roles level", () => {
    expect(accessRuleSchema.safeParse({ level: "roles" }).success).toBe(false);
    expect(accessRuleSchema.safeParse({ level: "roles", roles: [] }).success).toBe(false);
    expect(accessRuleSchema.safeParse({ level: "roles", roles: ["admin"] }).success).toBe(true);
  });

  it("rejects roles on other levels", () => {
    expect(accessRuleSchema.safeParse({ level: "public", roles: ["admin"] }).success).toBe(false);
    expect(accessRuleSchema.safeParse({ level: "authenticated" }).success).toBe(true);
  });
});

describe("fieldDefinitionSchema", () => {
  it("requires an enum reference on enum fields", () => {
    expect(fieldDefinitionSchema.safeParse(createField("status", "enum")).success).toBe(false);
    expect(
      fieldDefinitionSchema.safeParse(
        createField("status", "enum", { enumId: "enm_status" }),
      ).success,
    ).toBe(true);
  });

  it("only allows uuid or int primary keys", () => {
    expect(
      fieldDefinitionSchema.safeParse(createField("email", "string", { primary: true })).success,
    ).toBe(false);
    expect(
      fieldDefinitionSchema.safeParse(createField("id", "uuid", { primary: true })).success,
    ).toBe(true);
    expect(
      fieldDefinitionSchema.safeParse(createField("id", "int", { primary: true })).success,
    ).toBe(true);
  });

  it("rejects nullable primary keys", () => {
    expect(
      fieldDefinitionSchema.safeParse(
        createField("id", "uuid", { primary: true, required: false }),
      ).success,
    ).toBe(false);
  });
});

describe("migrateProject", () => {
  it("round-trips a version 1 project", () => {
    const project = createProject("Blog API");
    expect(migrateProject(structuredClone(project))).toEqual(project);
  });

  it("rejects future schema versions with a clear error", () => {
    const project = { ...createProject("Blog API"), schemaVersion: 2 };
    expect(() => migrateProject(project)).toThrow(/Unsupported project schema version: 2/);
  });

  it("populates password reset and email verification defaults when missing from legacy project", () => {
    const raw = createProject("Blog API") as unknown as Record<string, unknown>;
    const rawAuth = { ...(raw.auth as Record<string, unknown>) };
    delete rawAuth.passwordReset;
    delete rawAuth.emailVerification;
    delete rawAuth.passwordResetTtl;
    delete rawAuth.emailVerificationTtl;
    raw.auth = rawAuth;

    const migrated = migrateProject(raw);
    expect(migrated.auth.passwordReset).toBe(false);
    expect(migrated.auth.emailVerification).toBe(false);
    expect(migrated.auth.passwordResetTtl).toBe("1h");
    expect(migrated.auth.emailVerificationTtl).toBe("24h");
  });

  it("populates oauth defaults when missing from legacy project", () => {
    const raw = createProject("Blog API") as unknown as Record<string, unknown>;
    const rawAuth = { ...(raw.auth as Record<string, unknown>) };
    delete rawAuth.oauth;
    raw.auth = rawAuth;

    const migrated = migrateProject(raw);
    expect(migrated.auth.oauth).toEqual({ google: false, github: false });
  });

  it("populates twoFactor defaults when missing from legacy project", () => {
    const raw = createProject("Blog API") as unknown as Record<string, unknown>;
    const rawAuth = { ...(raw.auth as Record<string, unknown>) };
    delete rawAuth.twoFactor;
    raw.auth = rawAuth;

    const migrated = migrateProject(raw);
    expect(migrated.auth.twoFactor).toBe(false);
  });

  it("populates customEndpoints default when missing from legacy entity", () => {
    const raw = createProject("Blog API") as unknown as Record<string, unknown>;
    const entities = raw.entities as Record<string, unknown>[];
    delete entities[0].customEndpoints;

    const migrated = migrateProject(raw);
    expect(migrated.entities[0].customEndpoints).toEqual([]);
  });

  it("populates uploads default when missing from legacy settings", () => {
    const raw = createProject("Blog API") as unknown as Record<string, unknown>;
    const settings = raw.settings as Record<string, unknown>;
    delete settings.uploads;

    const migrated = migrateProject(raw);
    expect(migrated.settings.uploads).toEqual({
      enabled: false,
      driver: "local",
      maxFileSizeMb: 10,
    });
  });

  it("populates throttling default when missing from legacy settings", () => {
    const raw = createProject("Blog API") as unknown as Record<string, unknown>;
    const settings = raw.settings as Record<string, unknown>;
    delete settings.throttling;

    const migrated = migrateProject(raw);
    expect(migrated.settings.throttling).toEqual({
      enabled: true,
      ttl: 60,
      limit: 100,
    });
  });

  it("rejects non-object input", () => {
    expect(() => migrateProject("nope")).toThrow(/not an object/);
  });
});

describe("customEndpointSchema", () => {
  it("accepts valid custom endpoints", () => {
    const ep = createCustomEndpoint("publish", "POST", "/publish");
    expect(customEndpointSchema.safeParse(ep).success).toBe(true);
  });

  it("rejects invalid HTTP methods", () => {
    const ep = { ...createCustomEndpoint("publish"), method: "HEAD" };
    expect(customEndpointSchema.safeParse(ep).success).toBe(false);
  });

  it("requires camelCase names", () => {
    const ep = { ...createCustomEndpoint("publish"), name: "PublishArticle" };
    expect(customEndpointSchema.safeParse(ep).success).toBe(false);
  });

  it("rejects invalid path characters", () => {
    const ep = { ...createCustomEndpoint("publish"), path: "/publish with spaces" };
    expect(customEndpointSchema.safeParse(ep).success).toBe(false);
  });
});

describe("uploadConfigSchema", () => {
  it("accepts valid upload configs", () => {
    expect(
      uploadConfigSchema.safeParse({
        enabled: true,
        driver: "s3",
        maxFileSizeMb: 50,
      }).success,
    ).toBe(true);
  });

  it("rejects invalid drivers", () => {
    expect(
      uploadConfigSchema.safeParse({
        enabled: true,
        driver: "gcs",
        maxFileSizeMb: 10,
      }).success,
    ).toBe(false);
  });

  it("rejects negative or out-of-bounds file sizes", () => {
    expect(
      uploadConfigSchema.safeParse({
        enabled: true,
        driver: "local",
        maxFileSizeMb: 0,
      }).success,
    ).toBe(false);
    expect(
      uploadConfigSchema.safeParse({
        enabled: true,
        driver: "local",
        maxFileSizeMb: 1000,
      }).success,
    ).toBe(false);
  });
});

describe("multitenancyConfigSchema", () => {
  it("accepts valid multitenancy configs", () => {
    expect(
      multitenancyConfigSchema.safeParse({
        enabled: true,
        header: "x-org-id",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid header formats", () => {
    expect(
      multitenancyConfigSchema.safeParse({
        enabled: true,
        header: "X-Tenant ID",
      }).success,
    ).toBe(false);
    expect(
      multitenancyConfigSchema.safeParse({
        enabled: true,
        header: "",
      }).success,
    ).toBe(false);
  });
});

describe("throttlingConfigSchema", () => {
  it("accepts valid throttling configs", () => {
    expect(
      throttlingConfigSchema.safeParse({
        enabled: true,
        ttl: 60,
        limit: 100,
      }).success,
    ).toBe(true);
  });

  it("rejects invalid ttl or limit", () => {
    expect(
      throttlingConfigSchema.safeParse({
        enabled: true,
        ttl: 0,
        limit: 100,
      }).success,
    ).toBe(false);
    expect(
      throttlingConfigSchema.safeParse({
        enabled: true,
        ttl: 60,
        limit: 0,
      }).success,
    ).toBe(false);
  });
});

describe("throttleOverrideSchema", () => {
  it("accepts valid throttle overrides", () => {
    expect(
      throttleOverrideSchema.safeParse({
        limit: 10,
        ttl: 60,
      }).success,
    ).toBe(true);
  });

  it("rejects negative or zero values", () => {
    expect(
      throttleOverrideSchema.safeParse({
        limit: 0,
        ttl: 60,
      }).success,
    ).toBe(false);
    expect(
      throttleOverrideSchema.safeParse({
        limit: 10,
        ttl: -5,
      }).success,
    ).toBe(false);
  });
});

describe("cacheHintSchema", () => {
  it("accepts valid cache hints", () => {
    expect(
      cacheHintSchema.safeParse({
        maxAge: 300,
        scope: "public",
        sharedMaxAge: 600,
      }).success,
    ).toBe(true);
  });

  it("defaults scope to public", () => {
    const result = cacheHintSchema.parse({ maxAge: 60 });
    expect(result.scope).toBe("public");
  });

  it("rejects invalid scope", () => {
    expect(
      cacheHintSchema.safeParse({
        maxAge: 60,
        scope: "global",
      }).success,
    ).toBe(false);
  });

  it("rejects negative maxAge", () => {
    expect(
      cacheHintSchema.safeParse({
        maxAge: -1,
      }).success,
    ).toBe(false);
  });
});

describe("graphqlConfigSchema", () => {
  it("accepts valid graphql configuration", () => {
    expect(
      graphqlConfigSchema.safeParse({
        enabled: true,
        playground: false,
        path: "/custom-graphql",
      }).success,
    ).toBe(true);
  });

  it("applies defaults when empty object provided", () => {
    const result = graphqlConfigSchema.parse({});
    expect(result).toEqual({
      enabled: false,
      playground: true,
      path: "/graphql",
    });
  });

  it("rejects invalid path", () => {
    expect(
      graphqlConfigSchema.safeParse({
        enabled: true,
        path: "",
      }).success,
    ).toBe(false);
  });
});
