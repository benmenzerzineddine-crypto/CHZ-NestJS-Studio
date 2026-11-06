import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE,
  createCustomEndpoint,
  createEntity,
  createEnum,
  createField,
  createProject,
  createRelation,
  defaultAccess,
} from "../model/defaults";
import type { EntityDef, Project } from "../model/schema";
import { countIssues, validateProject } from "./validate";

function safeEntity(name: string): EntityDef {
  const entity = createEntity(name);
  entity.access = {
    list: { level: "authenticated" },
    read: { level: "authenticated" },
    create: { level: "authenticated" },
    update: { level: "authenticated" },
    delete: { level: "roles", roles: [ADMIN_ROLE] },
  };
  return entity;
}

function projectWith(...entities: EntityDef[]): Project {
  const project = createProject("Test API");
  project.entities.push(...entities);
  return project;
}

function codes(project: Project): string[] {
  return validateProject(project).map((issue) => issue.code);
}

describe("validateProject", () => {
  it("accepts a fresh project", () => {
    expect(validateProject(createProject("Test API"))).toEqual([]);
  });

  it("reports duplicate entity names", () => {
    expect(codes(projectWith(safeEntity("Post"), safeEntity("Post")))).toContain(
      "entity.name.duplicate",
    );
  });

  it("reports reserved entity names", () => {
    expect(codes(projectWith(safeEntity("Auth")))).toContain("entity.name.reserved");
  });

  it("reports REST path collisions", () => {
    const project = projectWith(safeEntity("Person"), safeEntity("People"));
    expect(codes(project)).toContain("entity.path.duplicate");
  });

  it("reports duplicate field names", () => {
    const entity = safeEntity("Post");
    entity.fields.push(createField("title", "string"), createField("title", "string"));
    expect(codes(projectWith(entity))).toContain("field.name.duplicate");
  });

  it("reports multiple primary fields", () => {
    const entity = safeEntity("Post");
    entity.fields.push(
      createField("id", "uuid", { primary: true }),
      createField("legacyId", "int", { primary: true }),
    );
    expect(codes(projectWith(entity))).toContain("field.primary.multiple");
  });

  it("reports enum fields without an enum", () => {
    const entity = safeEntity("Post");
    entity.fields.push(createField("status", "enum"));
    expect(codes(projectWith(entity))).toContain("field.enum.missing");
  });

  it("reports invalid search and sort fields", () => {
    const entity = safeEntity("Post");
    entity.fields.push(createField("views", "int"));
    entity.options.searchFields = ["views", "missing"];
    entity.options.sortFields = ["missing"];
    const found = codes(projectWith(entity));
    expect(found).toContain("entity.search.invalid");
    expect(found).toContain("entity.sort.invalid");
  });

  it("reports relations with missing targets", () => {
    const entity = safeEntity("Post");
    entity.relations.push(createRelation("author", "ent_missing"));
    expect(codes(projectWith(entity))).toContain("relation.target.missing");
  });

  it("reports relation names that collide with fields", () => {
    const entity = safeEntity("Post");
    entity.fields.push(createField("author", "string"));
    entity.relations.push(createRelation("author", "ent_user"));
    expect(codes(projectWith(entity))).toContain("relation.name.conflict");
  });

  it("rejects stored one-to-many relations", () => {
    const entity = safeEntity("Post");
    entity.relations.push(createRelation("comments", "ent_comment", "one-to-many"));
    const issues = validateProject(projectWith(entity));
    const error = issues.find((entry) => entry.code === "relation.one-to-many.stored");
    expect(error?.severity).toBe("error");
  });

  it("reports fields that collide with generated timestamp columns", () => {
    const entity = safeEntity("Post");
    entity.fields.push(createField("createdAt", "datetime"));
    expect(codes(projectWith(entity))).toContain("entity.generatedColumn.collision");
  });

  it("reports relation foreign keys that collide with fields", () => {
    const entity = safeEntity("Post");
    entity.fields.push(createField("authorId", "uuid"));
    entity.relations.push(createRelation("author", "ent_user", "many-to-one"));
    expect(codes(projectWith(entity))).toContain("relation.foreignKey.collision");
  });

  it("rejects public creates on owned entities", () => {
    const entity = safeEntity("Post");
    entity.options.owner = true;
    entity.options.ownerRelation = "owner";
    entity.relations.push(createRelation("owner", "ent_user", "many-to-one", { nullable: true }));
    entity.access.create = { level: "public" };
    expect(codes(projectWith(entity))).toContain("access.owner.public-create");
  });

  it("requires an owner relation when ownership is used", () => {
    const entity = safeEntity("Post");
    entity.access.update = { level: "owner" };
    expect(codes(projectWith(entity))).toContain("access.owner.missing");
  });

  it("requires the owner relation to target User", () => {
    const entity = safeEntity("Post");
    const tag = safeEntity("Tag");
    entity.options.owner = true;
    entity.options.ownerRelation = "owner";
    entity.relations.push(createRelation("owner", tag.id));
    const found = codes(projectWith(entity, tag));
    expect(found).toContain("entity.owner.relation.target");
  });

  it("accepts a correctly configured owner relation", () => {
    const entity = safeEntity("Post");
    entity.options.owner = true;
    entity.options.ownerRelation = "owner";
    entity.relations.push(createRelation("owner", "ent_user", "many-to-one", { nullable: true }));
    entity.access.update = { level: "owner" };

    const found = codes(projectWith(entity));
    expect(found).not.toContain("access.owner.missing");
    expect(found).not.toContain("entity.owner.relation.missing");
  });

  it("reports unknown roles", () => {
    const entity = safeEntity("Post");
    entity.access.list = { level: "roles", roles: ["ghost"] };
    expect(codes(projectWith(entity))).toContain("access.role.unknown");
  });

  it("warns about public writes", () => {
    const entity = safeEntity("Post");
    entity.access.create = { level: "public" };
    const issues = validateProject(projectWith(entity));
    expect(
      issues.some(
        (entry) => entry.code === "access.public.write" && entry.severity === "warning",
      ),
    ).toBe(true);
  });

  it("requires the admin role for admin endpoints and ownership bypass", () => {
    const project = createProject("Test API");
    project.auth.roles = [{ key: "user", label: "User" }];
    expect(codes(project)).toContain("auth.admin.missing");
  });

  it("warns about unused enums", () => {
    const project = createProject("Test API");
    project.enums.push(createEnum("PostStatus", ["draft"]));
    expect(codes(project)).toContain("enum.unused");
  });

  it("accepts an enum that is used by a field", () => {
    const project = createProject("Test API");
    const status = createEnum("PostStatus", ["draft", "published"]);
    project.enums.push(status);
    const entity = safeEntity("Post");
    entity.fields.push(createField("status", "enum", { enumId: status.id }));
    project.entities.push(entity);

    const found = codes(project);
    expect(found).not.toContain("enum.unused");
    expect(found).not.toContain("field.enum.unknown");
  });

  it("warns when authentication is disabled", () => {
    const project = createProject("Test API", "postgres", false);
    expect(codes(project)).toContain("auth.disabled");
  });

  it("counts errors and warnings", () => {
    const entity = safeEntity("Post");
    entity.access.create = { level: "public" };
    const issues = validateProject(projectWith(entity));
    const counts = countIssues(issues);
    expect(counts.errors).toBe(0);
    expect(counts.warnings).toBe(1);
  });

  it("checks default access rules after an entity is added", () => {
    const project = createProject("Test API");
    project.entities.push(createEntity("Post"));
    const issues = validateProject(project);
    expect(issues.some((entry) => entry.code === "access.owner.missing")).toBe(true);
    expect(defaultAccess().update.level).toBe("owner");
  });
});

describe("validateProject edge rules", () => {
  it("reports project metadata problems", () => {
    const project = createProject("Test API");
    project.entities = [];
    project.name = " ";
    project.packageName = "Bad Package";
    project.settings.apiPrefix = "API";

    const found = codes(project);
    expect(found).toContain("project.user.missing");
    expect(found).toContain("project.name.empty");
    expect(found).toContain("project.package.invalid");
    expect(found).toContain("project.prefix.invalid");
  });

  it("reports invalid identifiers and a renamed system entity", () => {
    const invalidEntity = safeEntity("post");
    const renamedUser = safeEntity("Account");
    renamedUser.id = "ent_user";
    const project = projectWith(invalidEntity, renamedUser);

    const found = codes(project);
    expect(found).toContain("entity.name.invalid");
    expect(found).toContain("entity.user.renamed");
  });

  it("reports invalid field names and enum references", () => {
    const entity = safeEntity("Post");
    entity.fields.push(
      createField("Bad Name", "string"),
      createField("password", "string"),
      createField("status", "enum", { enumId: "enm_missing" }),
      createField("kind", "string", { enumId: "enm_missing" }),
    );

    const found = codes(projectWith(entity));
    expect(found).toContain("field.name.invalid");
    expect(found).toContain("field.name.reserved");
    expect(found).toContain("field.enum.unknown");
    expect(found).toContain("field.enum.unexpected");
  });

  it("reports primary key and validator problems", () => {
    const entity = safeEntity("Post");
    entity.fields.push(
      createField("name", "string", { primary: true }),
      createField("externalId", "uuid", { primary: true, required: false }),
      createField("score", "int", { validators: { min: 10, max: 1 } }),
      createField("slug", "string", { validators: { minLength: 10, maxLength: 2 } }),
      createField("price", "decimal", { column: { precision: 2, scale: 5 } }),
    );

    const found = codes(projectWith(entity));
    expect(found).toContain("field.primary.type");
    expect(found).toContain("field.primary.nullable");
    expect(found).toContain("field.validator.range");
    expect(found).toContain("field.validator.length");
    expect(found).toContain("field.column.scale");
  });

  it("reports invalid and duplicate relation names", () => {
    const entity = safeEntity("Post");
    entity.relations.push(
      createRelation("Bad Relation", "ent_user"),
      createRelation("author", "ent_user"),
      createRelation("author", "ent_user"),
    );

    const found = codes(projectWith(entity));
    expect(found).toContain("relation.name.invalid");
    expect(found).toContain("relation.name.duplicate");
  });

  it("warns about duplicate search and sort fields", () => {
    const entity = safeEntity("Post");
    entity.fields.push(createField("title", "string"), createField("views", "int"));
    entity.options.searchFields = ["title", "title"];
    entity.options.sortFields = ["views", "views"];

    const found = codes(projectWith(entity));
    expect(found).toContain("entity.search.duplicate");
    expect(found).toContain("entity.sort.duplicate");
  });

  it("reports owner configuration problems", () => {
    const missing = safeEntity("Post");
    missing.options.owner = true;

    const wrongKind = safeEntity("Tag");
    wrongKind.options.owner = true;
    wrongKind.options.ownerRelation = "owner";
    wrongKind.relations.push(createRelation("owner", "ent_user", "many-to-many"));

    const disabled = safeEntity("Comment");
    disabled.options.owner = false;
    disabled.options.ownerRelation = "owner";

    const found = codes(projectWith(missing, wrongKind, disabled));
    expect(found).toContain("entity.owner.relation.missing");
    expect(found).toContain("entity.owner.relation.kind");
    expect(found).toContain("entity.owner.disabled");
  });

  it("reports empty role lists", () => {
    const entity = safeEntity("Post");
    entity.access.list = { level: "roles", roles: [] };
    expect(codes(projectWith(entity))).toContain("access.roles.missing");
  });

  it("reports enum value problems", () => {
    const project = createProject("Test API");
    project.enums.push(
      { id: "enm_empty", name: "Empty", values: [] },
      { id: "enm_invalid", name: "Invalid", values: ["bad value"] },
      { id: "enm_duplicate", name: "Duplicate", values: ["A", "A"] },
    );

    const found = codes(project);
    expect(found).toContain("enum.values.empty");
    expect(found).toContain("enum.value.invalid");
    expect(found).toContain("enum.value.duplicate");
  });

  it("reports auth role problems", () => {
    const duplicate = createProject("Test API");
    duplicate.auth.roles.push({ key: "admin", label: "Again" });
    expect(codes(duplicate)).toContain("auth.role.duplicate");

    const empty = createProject("Test API");
    empty.auth.roles = [];
    expect(codes(empty)).toContain("auth.roles.empty");
  });

  it("reports invalid auth durations and password bounds", () => {
    const project = createProject("Test API");
    project.auth.accessTokenTtl = "15";
    project.auth.refreshTokenTtl = "week";
    project.auth.passwordMinLength = 4;

    const found = codes(project);
    expect(found).toContain("auth.ttl.access");
    expect(found).toContain("auth.ttl.refresh");
    expect(found).toContain("auth.password.length");
  });

  it("warns about ignored admin flags when auth is disabled", () => {
    const project = createProject("Test API", "postgres", false);
    expect(codes(project)).toContain("auth.disabled.options");
  });

  it("reports reserved CRUD method names on custom endpoints", () => {
    const entity = safeEntity("Post");
    entity.customEndpoints.push(createCustomEndpoint("findAll", "GET", "/all"));
    expect(codes(projectWith(entity))).toContain("endpoint.name.reserved");
  });

  it("reports duplicate custom endpoint names", () => {
    const entity = safeEntity("Post");
    entity.customEndpoints.push(
      createCustomEndpoint("publish", "POST", "/publish"),
      createCustomEndpoint("publish", "PUT", "/publish-put"),
    );
    expect(codes(projectWith(entity))).toContain("endpoint.name.duplicate");
  });

  it("reports duplicate routes on custom endpoints", () => {
    const entity = safeEntity("Post");
    entity.customEndpoints.push(
      createCustomEndpoint("publishOne", "POST", "/publish"),
      createCustomEndpoint("publishTwo", "POST", "publish"),
    );
    expect(codes(projectWith(entity))).toContain("endpoint.route.duplicate");
  });

  it("reports custom endpoint routes that collide with CRUD routes", () => {
    const entity = safeEntity("Post");
    entity.customEndpoints.push(createCustomEndpoint("customGet", "GET", "/"));
    expect(codes(projectWith(entity))).toContain("endpoint.route.reserved");

    const entity2 = safeEntity("Article");
    entity2.customEndpoints.push(createCustomEndpoint("customFind", "GET", ":id"));
    expect(codes(projectWith(entity2))).toContain("endpoint.route.reserved");
  });

  it("reports unknown role on custom endpoint access rule", () => {
    const entity = safeEntity("Post");
    entity.customEndpoints.push(
      createCustomEndpoint("moderate", "POST", "/moderate", {
        level: "roles",
        roles: ["superhero"],
      }),
    );
    expect(codes(projectWith(entity))).toContain("endpoint.access.role.unknown");
  });

  it("reports owner access level on entity without owner relation", () => {
    const entity = safeEntity("Post");
    entity.options.owner = false;
    entity.customEndpoints.push(
      createCustomEndpoint("myDraft", "GET", "/my-draft", {
        level: "owner",
      }),
    );
    expect(codes(projectWith(entity))).toContain("endpoint.access.owner.missing");
  });

  it("reports invalid upload max file size", () => {
    const project = createProject("Test API");
    project.settings.uploads.maxFileSizeMb = 0;
    expect(codes(project)).toContain("project.uploads.size");

    const project2 = createProject("Test API");
    project2.settings.uploads.maxFileSizeMb = 1000;
    expect(codes(project2)).toContain("project.uploads.size");
  });

  it("reports entity name collision with /attachments route when uploads are enabled", () => {
    const project = createProject("Test API");
    project.settings.uploads.enabled = true;
    project.entities.push(safeEntity("Attachment"));
    expect(codes(project)).toContain("entity.path.reserved");
  });

  it("reports invalid multi-tenancy header names", () => {
    const project = createProject("Test API");
    project.settings.multitenancy.header = "Invalid Header!";
    expect(codes(project)).toContain("project.multitenancy.header");
  });

  it("reports reserved tenantId field collision when entity is multi-tenant", () => {
    const entity = safeEntity("Post");
    entity.options.multitenant = true;
    entity.fields.push(createField("tenantId", "string"));
    expect(codes(projectWith(entity))).toContain("field.name.reserved");
  });

  it("warns when entity is multi-tenant but project multi-tenancy is disabled", () => {
    const entity = safeEntity("Post");
    entity.options.multitenant = true;
    const project = projectWith(entity);
    project.settings.multitenancy.enabled = false;
    expect(codes(project)).toContain("entity.multitenant.disabled");
  });

  it("rejects multi-tenancy on the built-in User entity", () => {
    const project = createProject("Test API");
    project.settings.multitenancy.enabled = true;
    const user = project.entities.find((e) => e.name === "User");
    if (user) user.options.multitenant = true;
    expect(codes(project)).toContain("entity.multitenant.system");
  });

  it("reports cache hint on non-GET custom endpoints", () => {
    const entity = safeEntity("Post");
    const ep = createCustomEndpoint("publish", "POST", "/publish");
    ep.cache = { maxAge: 60, scope: "public" };
    entity.customEndpoints.push(ep);
    expect(codes(projectWith(entity))).toContain("endpoint.cache.method.invalid");
  });

  it("reports conflicting throttle override and skipThrottle", () => {
    const entity = safeEntity("Post");
    const ep = createCustomEndpoint("feed", "GET", "/feed");
    ep.skipThrottle = true;
    ep.throttle = { limit: 10, ttl: 60 };
    entity.customEndpoints.push(ep);
    expect(codes(projectWith(entity))).toContain("endpoint.throttle.conflict");
  });

  it("warns when sharedMaxAge is set on private or no-store cache hints", () => {
    const entity = safeEntity("Post");
    entity.options.cache = { maxAge: 60, scope: "private", sharedMaxAge: 120 };
    expect(codes(projectWith(entity))).toContain("entity.cache.sharedMaxAge.invalid");

    const ep = createCustomEndpoint("feed", "GET", "/feed");
    ep.cache = { maxAge: 60, scope: "no-store", sharedMaxAge: 120 };
    entity.customEndpoints.push(ep);
    expect(codes(projectWith(entity))).toContain("endpoint.cache.sharedMaxAge.invalid");
  });
});
