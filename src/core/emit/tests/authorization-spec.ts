import type { EntityIR, GeneratedFile, ProjectIR } from "../../ir/types";
import { USER_ENTITY_PATH, entityFilePath, file } from "../helpers";
import { apiBase, buildableEntities, entityPath, importPath } from "./common";

export function testEntity(ir: ProjectIR, entity: EntityIR): string {
  const lines: string[] = [];
  const path = entityPath(ir, entity);
  const supports403 = (operation: keyof EntityIR["access"]): boolean => {
    const rule = entity.access[operation];
    return rule.level === "roles" && !(rule.roles ?? []).includes(ir.auth.defaultRole);
  };
  const primary = entity.primary.name;

  lines.push(`  describe(${JSON.stringify(entity.name)}, () => {`);
  lines.push(`    let sample: ${entity.name};`);
  lines.push("");
  lines.push("    beforeAll(async () => {");
  lines.push(`      sample = await factory.make${entity.name}(unique("${entity.singularKebab}"));`);
  lines.push("    });");

  if (entity.access.list.level === "public") {
    lines.push("");
    lines.push('    it("allows anonymous list", async () => {');
    lines.push(`      const response = await request(app.getHttpServer()).get("${path}");`);
    lines.push("      expect(response.status).toBe(200);");
    lines.push("    });");
  }

  if (entity.access.read.level === "public") {
    lines.push("");
    lines.push('    it("allows anonymous read", async () => {');
    lines.push(`      const response = await request(app.getHttpServer()).get(\`${path}/\${sample.${primary}}\`);`);
    lines.push("      expect(response.status).toBe(200);");
    lines.push("    });");
  }

  for (const operation of ["list", "read", "create", "update", "delete"] as const) {
    if (entity.access[operation].level === "public") continue;
    const label = operation === "read" ? "read" : operation;
    lines.push("");
    lines.push(`    it("rejects anonymous ${label}", async () => {`);
    if (operation === "list") {
      lines.push(`      const response = await request(app.getHttpServer()).get("${path}");`);
    } else if (operation === "create") {
      lines.push(`      const response = await request(app.getHttpServer()).post("${path}").send({});`);
    } else if (operation === "read") {
      lines.push(`      const response = await request(app.getHttpServer()).get(\`${path}/\${sample.${primary}}\`);`);
    } else if (operation === "update") {
      lines.push(
        `      const response = await request(app.getHttpServer()).patch(\`${path}/\${sample.${primary}}\`).send({});`,
      );
    } else {
      lines.push(`      const response = await request(app.getHttpServer()).delete(\`${path}/\${sample.${primary}}\`);`);
    }
    lines.push("      expect(response.status).toBe(401);");
    lines.push("    });");
  }

  for (const operation of ["list", "read", "create", "update", "delete"] as const) {
    if (!supports403(operation)) continue;
    const label = operation === "read" ? "read" : operation;
    lines.push("");
    lines.push(`    it("rejects ${label} without a required role", async () => {`);
    if (operation === "list") {
      lines.push(
        `      const response = await request(app.getHttpServer()).get("${path}").set(authHeader(otherToken));`,
      );
    } else if (operation === "create") {
      lines.push(
        `      const response = await request(app.getHttpServer()).post("${path}").set(authHeader(otherToken)).send({});`,
      );
    } else if (operation === "read") {
      lines.push(
        `      const response = await request(app.getHttpServer()).get(\`${path}/\${sample.${primary}}\`).set(authHeader(otherToken));`,
      );
    } else if (operation === "update") {
      lines.push(
        `      const response = await request(app.getHttpServer()).patch(\`${path}/\${sample.${primary}}\`).set(authHeader(otherToken)).send({});`,
      );
    } else {
      lines.push(
        `      const response = await request(app.getHttpServer()).delete(\`${path}/\${sample.${primary}}\`).set(authHeader(otherToken));`,
      );
    }
    lines.push("      expect(response.status).toBe(403);");
    lines.push("    });");
  }

  if (entity.ownerColumn) {
    if (entity.access.list.level === "owner") {
      lines.push("");
      lines.push('    it("scopes list results to the owner", async () => {');
      lines.push(`      const ownerResponse = await request(app.getHttpServer()).get("${path}").set(authHeader(ownerToken));`);
      lines.push("      expect(ownerResponse.status).toBe(200);");
      lines.push(`      expect(listItems(ownerResponse.body).some((item) => item[${JSON.stringify(primary)}] === sample.${primary})).toBe(true);`);
      lines.push(`      const otherResponse = await request(app.getHttpServer()).get("${path}").set(authHeader(otherToken));`);
      lines.push("      expect(otherResponse.status).toBe(200);");
      lines.push(`      expect(listItems(otherResponse.body).some((item) => item[${JSON.stringify(primary)}] === sample.${primary})).toBe(false);`);
      lines.push(`      const adminResponse = await request(app.getHttpServer()).get("${path}").set(authHeader(adminToken));`);
      lines.push("      expect(adminResponse.status).toBe(200);");
      lines.push(`      expect(listItems(adminResponse.body).some((item) => item[${JSON.stringify(primary)}] === sample.${primary})).toBe(true);`);
      lines.push("    });");
    }

    if (entity.access.read.level === "owner") {
      lines.push("");
      lines.push('    it("protects owner reads", async () => {');
      lines.push(
        `      const ownerResponse = await request(app.getHttpServer()).get(\`${path}/\${sample.${primary}}\`).set(authHeader(ownerToken));`,
      );
      lines.push("      expect(ownerResponse.status).toBe(200);");
      lines.push(
        `      const otherResponse = await request(app.getHttpServer()).get(\`${path}/\${sample.${primary}}\`).set(authHeader(otherToken));`,
      );
      lines.push("      expect(otherResponse.status).toBe(404);");
      lines.push(
        `      const adminResponse = await request(app.getHttpServer()).get(\`${path}/\${sample.${primary}}\`).set(authHeader(adminToken));`,
      );
      lines.push("      expect(adminResponse.status).toBe(200);");
      lines.push("    });");
    }

    if (entity.access.update.level === "owner") {
      lines.push("");
      lines.push('    it("protects owner updates", async () => {');
      lines.push(
        `      const ownerResponse = await request(app.getHttpServer()).patch(\`${path}/\${sample.${primary}}\`).set(authHeader(ownerToken)).send({});`,
      );
      lines.push("      expect(ownerResponse.status).toBe(200);");
      lines.push(
        `      const otherResponse = await request(app.getHttpServer()).patch(\`${path}/\${sample.${primary}}\`).set(authHeader(otherToken)).send({});`,
      );
      lines.push("      expect(otherResponse.status).toBe(404);");
      lines.push(
        `      const adminResponse = await request(app.getHttpServer()).patch(\`${path}/\${sample.${primary}}\`).set(authHeader(adminToken)).send({});`,
      );
      lines.push("      expect(adminResponse.status).toBe(200);");
      lines.push("    });");
    }

    if (entity.access.delete.level === "owner") {
      lines.push("");
      lines.push('    it("protects owner deletes", async () => {');
      lines.push(
        `      const ownerRow = await factory.make${entity.name}(unique("${entity.singularKebab}-owner-delete"));`,
      );
      lines.push(
        `      const ownerResponse = await request(app.getHttpServer()).delete(\`${path}/\${ownerRow.${primary}}\`).set(authHeader(ownerToken));`,
      );
      lines.push("      expect(ownerResponse.status).toBe(204);");
      lines.push(
        `      const otherRow = await factory.make${entity.name}(unique("${entity.singularKebab}-other-delete"));`,
      );
      lines.push(
        `      const otherResponse = await request(app.getHttpServer()).delete(\`${path}/\${otherRow.${primary}}\`).set(authHeader(otherToken));`,
      );
      lines.push("      expect(otherResponse.status).toBe(404);");
      lines.push(
        `      const adminRow = await factory.make${entity.name}(unique("${entity.singularKebab}-admin-delete"));`,
      );
      lines.push(
        `      const adminResponse = await request(app.getHttpServer()).delete(\`${path}/\${adminRow.${primary}}\`).set(authHeader(adminToken));`,
      );
      lines.push("      expect(adminResponse.status).toBe(204);");
      lines.push("    });");
    }
  }

  const nullableDate = entity.fields.find(
    (field) =>
      !field.required &&
      (field.type === "date" || field.type === "datetime") &&
      field.name !== "deletedAt",
  );
  if (nullableDate) {
    const updateRule = entity.access.update;
    const token =
      updateRule.level === "owner"
        ? "ownerToken"
        : updateRule.level === "roles"
          ? "creatorToken"
          : updateRule.level === "authenticated"
            ? "otherToken"
            : "null";
    lines.push("");
    lines.push(`    it("clears the nullable ${nullableDate.name} date", async () => {`);
    lines.push(
      `      const setDate = await request(app.getHttpServer()).patch(\`${path}/\${sample.${primary}}\`).set(authHeader(${token})).send({ ${nullableDate.name}: "2024-02-02T00:00:00.000Z" });`,
    );
    lines.push("      expect(setDate.status).toBe(200);");
    lines.push(`      expect(setDate.body.${nullableDate.name}).toBeTruthy();`);
    lines.push("");
    lines.push(
      `      const cleared = await request(app.getHttpServer()).patch(\`${path}/\${sample.${primary}}\`).set(authHeader(${token})).send({ ${nullableDate.name}: null });`,
    );
    lines.push("      expect(cleared.status).toBe(200);");
    lines.push(`      expect(cleared.body.${nullableDate.name}).toBeNull();`);
    lines.push("    });");
  }

  lines.push("  });");
  return lines.join("\n");
}

export function emitAuthorizationSpec(ir: ProjectIR): GeneratedFile {
  const buildable = buildableEntities(ir);
  const tested = ir.entities.filter(
    (entity) =>
      !entity.isSystem &&
      buildable.has(entity.id) &&
      Object.values(entity.access).some((rule) => rule.level !== "public"),
  );

  const roleKeys = ir.auth.roles.map((role) => JSON.stringify(role.key)).join(", ");
  const api = apiBase(ir);
  const adminRole = JSON.stringify(ir.auth.adminRole);
  const defaultRole = JSON.stringify(ir.auth.defaultRole);
  const user = ir.user;
  if (!user) throw new Error("The project has no built-in User entity.");

  const lines: string[] = [];
  lines.push('import { INestApplication } from "@nestjs/common";');
  lines.push('import { randomUUID } from "node:crypto";');
  lines.push('import request from "supertest";');
  lines.push('import { DataSource } from "typeorm";');
  lines.push(`import { User } from "${importPath(USER_ENTITY_PATH)}";`);
  for (const entity of ir.entities.filter((candidate) => !candidate.isSystem)) {
    lines.push(`import { ${entity.name} } from "${importPath(entityFilePath(entity))}";`);
  }
  lines.push('import { authHeader, createTestApp, createUser, login } from "./utils/auth";');
  lines.push('import { listItems, unique } from "./utils/db";');
  lines.push('import { createFactories } from "./utils/factories";');
  lines.push('import { UsersService } from "../src/users/users.service";');
  lines.push("");
  lines.push("jest.setTimeout(30_000);");
  lines.push("");
  lines.push('describe("authorization", () => {');
  lines.push("  let app: INestApplication;");
  lines.push("  let dataSource: DataSource;");
  lines.push("  let admin: User;");
  lines.push("  let owner: User;");
  lines.push("  let other: User;");
  lines.push("  let creator: User;");
  lines.push("  let adminToken: string;");
  lines.push("  let ownerToken: string;");
  lines.push("  let otherToken: string;");
  lines.push("  let creatorToken: string;");
  lines.push("  let factory: ReturnType<typeof createFactories>;");
  lines.push("");
  lines.push("  beforeAll(async () => {");
  lines.push("    app = await createTestApp();");
  lines.push("    dataSource = app.get(DataSource);");
  lines.push(`    admin = await createUser(app, [${adminRole}]);`);
  lines.push(`    owner = await createUser(app, [${defaultRole}]);`);
  lines.push(`    other = await createUser(app, [${defaultRole}]);`);
  lines.push(`    creator = await createUser(app, [${roleKeys}]);`);
  lines.push("    adminToken = await login(app, admin.email);");
  lines.push("    ownerToken = await login(app, owner.email);");
  lines.push("    otherToken = await login(app, other.email);");
  lines.push("    creatorToken = await login(app, creator.email);");
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
  lines.push("  });");
  lines.push("");
  lines.push("  afterAll(async () => {");
  lines.push("    await app.close();");
  lines.push("  });");
  lines.push("");
  for (const entity of tested) {
    lines.push(testEntity(ir, entity));
    lines.push("");
  }

  lines.push('  describe("user account security", () => {');
  lines.push('    it("strips roles and password fields from profile updates", async () => {');
  lines.push(
    `      const response = await request(app.getHttpServer()).patch("${api}/users/me").set(authHeader(otherToken)).send({`,
  );
  lines.push('        roles: ["admin"],');
  lines.push('        password: "EscalatedPassword123!",');
  lines.push('        passwordHash: "forged",');
  lines.push("        isActive: false,");
  lines.push("      });");
  lines.push("      expect(response.status).toBe(200);");
  lines.push("      expect(response.body.roles).toEqual(other.roles);");
  lines.push("      expect(response.body.isActive).toBe(true);");
  lines.push("      expect(response.body.passwordHash).toBeUndefined();");
  lines.push("    });");
  lines.push("");
  lines.push('    it("lets a user update their own profile email", async () => {');
  lines.push("      const email = `profile-${randomUUID()}@example.com`;");
  lines.push(
    `      const response = await request(app.getHttpServer()).patch("${api}/users/me").set(authHeader(otherToken)).send({ email });`,
  );
  lines.push("      expect(response.status).toBe(200);");
  lines.push("      expect(response.body.email).toBe(email);");
  lines.push("    });");

  if (ir.auth.adminUserEndpoints) {
    lines.push("");
    lines.push('    it("rejects non-admin user listing", async () => {');
    lines.push(
      `      const response = await request(app.getHttpServer()).get("${api}/users").set(authHeader(otherToken));`,
    );
    lines.push("      expect(response.status).toBe(403);");
    lines.push("    });");
    lines.push("");
    lines.push('    it("lets an admin list users without password hashes", async () => {');
    lines.push(
      `      const response = await request(app.getHttpServer()).get("${api}/users").set(authHeader(adminToken));`,
    );
    lines.push("      expect(response.status).toBe(200);");
    lines.push("      const items = listItems(response.body);");
    lines.push("      expect(items.length).toBeGreaterThan(0);");
    lines.push('      expect(items[0]["passwordHash"]).toBeUndefined();');
    lines.push("    });");
    lines.push("");
    lines.push('    it("rejects role changes by non-admins", async () => {');
    lines.push(
      `      const response = await request(app.getHttpServer()).patch(\`${api}/users/\${other.id}/roles\`).set(authHeader(otherToken)).send({ roles: [${defaultRole}] });`,
    );
    lines.push("      expect(response.status).toBe(403);");
    lines.push("    });");
    lines.push("");
    lines.push('    it("blocks admins from changing their own roles", async () => {');
    lines.push(
      `      const response = await request(app.getHttpServer()).patch(\`${api}/users/\${admin.id}/roles\`).set(authHeader(adminToken)).send({ roles: [${defaultRole}] });`,
    );
    lines.push("      expect(response.status).toBe(400);");
    lines.push("    });");
    lines.push("");
    lines.push('    it("blocks admins from deleting themselves", async () => {');
    lines.push(
      `      const response = await request(app.getHttpServer()).delete(\`${api}/users/\${admin.id}\`).set(authHeader(adminToken));`,
    );
    lines.push("      expect(response.status).toBe(400);");
    lines.push("    });");
  }

  lines.push("  });");

  if (ir.auth.adminUserEndpoints) {
    lines.push("");
    lines.push('  describe("last admin guard", () => {');
    lines.push('    it("refuses to delete or demote the last admin", async () => {');
    lines.push(`      const last = await createUser(app, [${adminRole}]);`);
    lines.push("      const users = app.get(UsersService);");
    lines.push(
      `      await dataSource.getRepository(User).update(admin.id, { roles: [${defaultRole}] });`,
    );
    lines.push(
      `      await dataSource.getRepository(User).update(creator.id, { roles: [${defaultRole}] });`,
    );
    lines.push(
      '      await expect(users.remove(last.id, other.id)).rejects.toThrow("last admin");',
    );
    lines.push(
      `      await expect(users.updateRoles(last.id, [${defaultRole}], other.id)).rejects.toThrow(`,
    );
    lines.push('        "last admin",');
    lines.push("      );");
    lines.push("    });");
  }

  lines.push("  });");
  lines.push("});");

  return file("test/authorization.e2e-spec.ts", lines.join("\n") + "\n", "typescript");
}
