import type { EntityIR, GeneratedFile, ProjectIR } from "../../ir/types";
import { entityFilePath, file } from "../helpers";
import { buildableEntities, entityPath, importPath } from "./common";

function tokenExpression(
  ir: ProjectIR,
  entity: EntityIR,
  operation: keyof EntityIR["access"],
): string {
  if (!ir.auth.enabled) return "null";
  const rule = entity.access[operation];
  if (rule.level === "public") return "null";
  if (rule.level === "owner") return "ownerToken";
  return "creatorToken";
}

function invalidValueFor(_field: EntityIR["fields"][number]): string {
  return "null";
}

export function emitEntitySpec(ir: ProjectIR, entity: EntityIR): GeneratedFile {
  const path = `test/${entity.singularKebab}.e2e-spec.ts`;
  const endpoint = entityPath(ir, entity);
  const primary = entity.primary.name;
  const createToken = tokenExpression(ir, entity, "create");
  const listToken = tokenExpression(ir, entity, "list");
  const readToken = tokenExpression(ir, entity, "read");
  const updateToken = tokenExpression(ir, entity, "update");
  const deleteToken = tokenExpression(ir, entity, "delete");
  const roleKeys = ir.auth.roles.map((role) => JSON.stringify(role.key)).join(", ");
  const defaultRole = JSON.stringify(ir.auth.defaultRole);
  const adminRole = JSON.stringify(ir.auth.adminRole);
  const writable = entity.fields.find((field) => !field.primary);
  const requiredScalar = entity.fields.find(
    (field) =>
      !field.primary &&
      field.required &&
      field.defaultValue === undefined &&
      field.type !== "json",
  );
  const hasRequiredRelation = entity.relations.some(
    (relation) =>
      relation.fkName !== undefined &&
      !relation.owner &&
      !relation.nullable &&
      relation.kind !== "many-to-many",
  );
  const filterField = entity.fields.find(
    (field) => !field.primary && (field.type === "string" || field.type === "text"),
  );

  const lines: string[] = [];
  lines.push('import { INestApplication } from "@nestjs/common";');
  lines.push('import { randomUUID } from "node:crypto";');
  lines.push('import request from "supertest";');
  lines.push('import { DataSource } from "typeorm";');
  lines.push(`import { ${entity.name} } from "${importPath(entityFilePath(entity))}";`);
  lines.push('import { authHeader, createTestApp, createUser, login } from "./utils/auth";');
  lines.push('import { listItems, unique } from "./utils/db";');
  lines.push('import { createFactories } from "./utils/factories";');
  lines.push("");
  lines.push("jest.setTimeout(30_000);");
  lines.push("");
  lines.push(`describe("${entity.name} CRUD", () => {`);
  lines.push("  let app: INestApplication;");
  lines.push("  let dataSource: DataSource;");
  lines.push("  let factory: ReturnType<typeof createFactories>;");
  lines.push(`  let sample: ${entity.name};`);
  lines.push("  let adminToken = \"\";");
  lines.push("  let ownerToken = \"\";");
  lines.push("  let otherToken = \"\";");
  lines.push("  let creatorToken = \"\";");
  lines.push("");
  lines.push("  beforeAll(async () => {");
  lines.push("    app = await createTestApp();");
  lines.push("    dataSource = app.get(DataSource);");
  lines.push(`    const owner = await createUser(app, [${defaultRole}]);`);
  lines.push(`    const other = await createUser(app, [${defaultRole}]);`);
  if (ir.auth.enabled) {
    lines.push(`    const admin = await createUser(app, [${adminRole}]);`);
    lines.push("    adminToken = await login(app, admin.email);");
    lines.push("    ownerToken = await login(app, owner.email);");
    lines.push("    otherToken = await login(app, other.email);");
    const creator = "creator";
    lines.push(`    const ${creator} = await createUser(app, [${roleKeys}]);`);
    lines.push("    creatorToken = await login(app, creator.email);");
  }
  lines.push("    factory = createFactories({");
  lines.push("      app,");
  lines.push("      dataSource,");
  lines.push("      tokens: {");
  lines.push("        admin: adminToken,");
  lines.push("        owner: ownerToken,");
  lines.push("        other: otherToken,");
  lines.push("        creator: creatorToken,");
  lines.push("      },");
  lines.push("      ownerId: owner.id,");
  lines.push("    });");
  lines.push(
    `    sample = await factory.make${entity.name}(unique("${entity.singularKebab}"), ${createToken});`,
  );
  lines.push("  });");
  lines.push("");
  lines.push("  afterAll(async () => {");
  lines.push("    await app.close();");
  lines.push("  });");
  lines.push("");
  lines.push(`  it("creates a ${entity.name}", async () => {`);
  lines.push(
    `    const payload = await factory.build${entity.name}(unique("${entity.singularKebab}-create"));`,
  );
  lines.push(`    const response = await request(app.getHttpServer()).post("${endpoint}")`);
  lines.push(`      .set(authHeader(${createToken}))`);
  lines.push("      .send(payload);");
  lines.push("    expect(response.status).toBe(201);");
  lines.push("  });");
  lines.push("");
  lines.push(`  it("lists ${entity.name} records", async () => {`);
  lines.push(
    `    const response = await request(app.getHttpServer()).get("${endpoint}").set(authHeader(${listToken}));`,
  );
  lines.push("    expect(response.status).toBe(200);");
  lines.push(
    `    expect(listItems(response.body).some((item) => item[${JSON.stringify(primary)}] === sample.${primary})).toBe(true);`,
  );
  lines.push("  });");
  lines.push("");
  if (entity.options.pagination) {
    lines.push(`  it("paginates ${entity.name} records", async () => {`);
    lines.push(
      `    const response = await request(app.getHttpServer()).get("${endpoint}?limit=1&page=1").set(authHeader(${listToken}));`,
    );
    lines.push("    expect(response.status).toBe(200);");
    lines.push("    expect(response.body.meta).toMatchObject({ page: 1, limit: 1 });");
    lines.push("    expect(response.body.meta.totalPages).toBeGreaterThanOrEqual(1);");
    lines.push("  });");
    lines.push("");
  }
  lines.push(`  it("rejects invalid ${entity.name} list queries", async () => {`);
  lines.push(
    `    const badLimit = await request(app.getHttpServer()).get("${endpoint}?limit=101").set(authHeader(${listToken}));`,
  );
  lines.push("    expect(badLimit.status).toBe(400);");
  lines.push(
    `    const badSort = await request(app.getHttpServer()).get("${endpoint}?sort=__not_a_field__").set(authHeader(${listToken}));`,
  );
  lines.push("    expect(badSort.status).toBe(400);");
  lines.push("  });");
  lines.push("");
  if (filterField) {
    lines.push(`  it("filters ${entity.name} records", async () => {`);
    lines.push(`    const value = encodeURIComponent(String(sample.${filterField.name}));`);
    lines.push(
      `    const response = await request(app.getHttpServer()).get(\`${endpoint}?${filterField.name}=\${value}\`).set(authHeader(${listToken}));`,
    );
    lines.push("    expect(response.status).toBe(200);");
    lines.push(
      `    expect(listItems(response.body).some((item) => item[${JSON.stringify(primary)}] === sample.${primary})).toBe(true);`,
    );
    if (entity.ownerColumn && entity.access.list.level === "owner") {
      lines.push(
        `    const other = await request(app.getHttpServer()).get(\`${endpoint}?${filterField.name}=\${value}\`).set(authHeader(otherToken));`,
      );
      lines.push("    expect(other.status).toBe(200);");
      lines.push(
        `    expect(listItems(other.body).some((item) => item[${JSON.stringify(primary)}] === sample.${primary})).toBe(false);`,
      );
    }
    lines.push("  });");
    lines.push("");
  }
  lines.push(`  it("reads a ${entity.name}", async () => {`);
  lines.push(
    `    const response = await request(app.getHttpServer()).get(\`${endpoint}/\${sample.${primary}}\`).set(authHeader(${readToken}));`,
  );
  lines.push("    expect(response.status).toBe(200);");
  lines.push(`    expect(response.body.${primary}).toBe(sample.${primary});`);
  lines.push("  });");
  lines.push("");
  lines.push(`  it("updates a ${entity.name}", async () => {`);
  if (writable) {
    lines.push(
      `    const payload = await factory.build${entity.name}(unique("${entity.singularKebab}-update"));`,
    );
    lines.push(
      `    const response = await request(app.getHttpServer()).patch(\`${endpoint}/\${sample.${primary}}\`).set(authHeader(${updateToken})).send({ ${writable.name}: payload.${writable.name} });`,
    );
  } else {
    lines.push(
      `    const response = await request(app.getHttpServer()).patch(\`${endpoint}/\${sample.${primary}}\`).set(authHeader(${updateToken})).send({});`,
    );
  }
  lines.push("    expect(response.status).toBe(200);");
  lines.push("  });");
  lines.push("");
  lines.push(`  it("deletes and restores a ${entity.name}", async () => {`);
  lines.push(
    `    const row = await factory.make${entity.name}(unique("${entity.singularKebab}-delete"), ${deleteToken});`,
  );
  lines.push(
    `    const removed = await request(app.getHttpServer()).delete(\`${endpoint}/\${row.${primary}}\`).set(authHeader(${deleteToken}));`,
  );
  lines.push("    expect(removed.status).toBe(204);");
  lines.push(
    `    const missing = await request(app.getHttpServer()).get(\`${endpoint}/\${row.${primary}}\`).set(authHeader(${readToken}));`,
  );
  lines.push("    expect(missing.status).toBe(404);");
  if (entity.softDelete) {
    if (ir.auth.enabled) {
      lines.push(
        `    const forbidden = await request(app.getHttpServer()).get("${endpoint}?withDeleted=true").set(authHeader(otherToken));`,
      );
      lines.push("    expect(forbidden.status).toBe(403);");
    }
    lines.push(
      `    const withDeleted = await request(app.getHttpServer()).get("${endpoint}?withDeleted=true").set(authHeader(creatorToken));`,
    );
    lines.push("    expect(withDeleted.status).toBe(200);");
    lines.push(
      `    expect(listItems(withDeleted.body).some((item) => item[${JSON.stringify(primary)}] === row.${primary})).toBe(true);`,
    );
    lines.push(
      `    const restored = await request(app.getHttpServer()).post(\`${endpoint}/\${row.${primary}}/restore\`).set(authHeader(${deleteToken}));`,
    );
    lines.push("    expect(restored.status).toBe(204);");
    lines.push(
      `    const afterRestore = await request(app.getHttpServer()).get(\`${endpoint}/\${row.${primary}}\`).set(authHeader(${readToken}));`,
    );
    lines.push("    expect(afterRestore.status).toBe(200);");
  }
  lines.push("  });");
  lines.push("");
  lines.push(`  it("rejects invalid ${entity.name} input", async () => {`);
  if (requiredScalar) {
    lines.push(`    const payload: Record<string, unknown> = {`);
    lines.push(`      ${requiredScalar.name}: ${invalidValueFor(requiredScalar)},`);
    lines.push("    };");
    lines.push(`    const response = await request(app.getHttpServer()).post("${endpoint}")`);
    lines.push(`      .set(authHeader(${createToken}))`);
    lines.push("      .send(payload);");
    lines.push("    expect(response.status).toBe(400);");
  } else if (hasRequiredRelation) {
    lines.push(
      `    const response = await request(app.getHttpServer()).post("${endpoint}").set(authHeader(${createToken})).send({});`,
    );
    lines.push("    expect(response.status).toBe(400);");
  } else {
    lines.push(
      `    const response = await request(app.getHttpServer()).get("${endpoint}?limit=101").set(authHeader(${listToken}));`,
    );
    lines.push("    expect(response.status).toBe(400);");
  }
  lines.push("  });");
  lines.push("");
  lines.push(`  it("returns 404 for a missing ${entity.name}", async () => {`);
  lines.push(
    entity.primary.type === "int"
      ? '    const missingId = 999999;'
      : "    const missingId = randomUUID();",
  );
  lines.push(
    `    const response = await request(app.getHttpServer()).get(\`${endpoint}/\${missingId}\`).set(authHeader(${readToken}));`,
  );
  lines.push("    expect(response.status).toBe(404);");
  lines.push("  });");

  if (entity.ownerColumn && ir.auth.enabled) {
    if (entity.access.read.level === "owner") {
      lines.push("");
      lines.push(`  it("hides another owner's ${entity.name}", async () => {`);
      lines.push(
        `    const owned = await factory.make${entity.name}(unique("${entity.singularKebab}-owned"), ownerToken);`,
      );
      lines.push(
        `    const other = await request(app.getHttpServer()).get(\`${endpoint}/\${owned.${primary}}\`).set(authHeader(otherToken));`,
      );
      lines.push("    expect(other.status).toBe(404);");
      lines.push(
        `    const admin = await request(app.getHttpServer()).get(\`${endpoint}/\${owned.${primary}}\`).set(authHeader(adminToken));`,
      );
      lines.push("    expect(admin.status).toBe(200);");
      lines.push("  });");
    }
    if (entity.access.list.level === "owner") {
      lines.push("");
      lines.push(`  it("scopes the ${entity.name} list to its owner", async () => {`);
      lines.push(
        `    const owned = await factory.make${entity.name}(unique("${entity.singularKebab}-owned-list"), ownerToken);`,
      );
      lines.push(
        `    const other = await request(app.getHttpServer()).get("${endpoint}").set(authHeader(otherToken));`,
      );
      lines.push("    expect(other.status).toBe(200);");
      lines.push(
        `    expect(listItems(other.body).some((item) => item[${JSON.stringify(primary)}] === owned.${primary})).toBe(false);`,
      );
      lines.push(
        `    const admin = await request(app.getHttpServer()).get("${endpoint}").set(authHeader(adminToken));`,
      );
      lines.push("    expect(admin.status).toBe(200);");
      lines.push(
        `    expect(listItems(admin.body).some((item) => item[${JSON.stringify(primary)}] === owned.${primary})).toBe(true);`,
      );
      lines.push("  });");
    }
  }

  lines.push("});");
  lines.push("");
  return file(path, lines.join("\n"), "typescript");
}

export function emitEntitySpecs(ir: ProjectIR): GeneratedFile[] {
  const buildable = buildableEntities(ir);
  return ir.entities
    .filter((entity) => !entity.isSystem && buildable.has(entity.id))
    .map((entity) => emitEntitySpec(ir, entity));
}
